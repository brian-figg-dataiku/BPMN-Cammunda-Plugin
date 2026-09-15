import json
import uuid
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

import dataiku
from flask import request

# DSS provides the Flask app object in standard webapps

BPMN_FOLDER_ID = "lRtmKjvu"  # managed folder bpmn_log
BPMN_FILENAME = "process.bpmn"


# DSS provides the Flask app object in standard webapps

SAMPLE_DETAILS_DS = "sample_collection_details"
PROCESS_ADHERENCE_DS = "process_adherence_questionnaire"
DEVIATION_DS = "deviation_log"


def _read_bpmn_xml():
    folder = dataiku.Folder(BPMN_FOLDER_ID)
    with folder.get_download_stream(BPMN_FILENAME) as f:
        return f.read()


def _local(tag):
    # Strip XML namespace
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag


def _parse_bpmn_sequence():
    """Parse BPMN into a simple directed graph from <sequenceFlow>.

    Uses element 'id' as the stable key.
    """
    xml_bytes = _read_bpmn_xml()
    root = ET.fromstring(xml_bytes)

    nodes = {}
    outgoing = {}
    incoming = {}
    seq_flows = []
    start_events = []

    for el in root.iter():
        t = _local(el.tag)
        el_id = el.attrib.get('id')
        if not el_id:
            continue

        if t in (
            'startEvent', 'endEvent', 'task', 'userTask', 'serviceTask', 'scriptTask',
            'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway'
        ):
            nodes[el_id] = {
                'id': el_id,
                'type': t,
                'name': el.attrib.get('name', '')
            }
            if t == 'startEvent':
                start_events.append(el_id)

        if t == 'sequenceFlow':
            src = el.attrib.get('sourceRef')
            dst = el.attrib.get('targetRef')
            if src and dst:
                seq_flows.append({'id': el_id, 'source': src, 'target': dst, 'name': el.attrib.get('name', '')})
                outgoing.setdefault(src, []).append(dst)
                incoming.setdefault(dst, []).append(src)

    start_event = start_events[0] if start_events else None
    return {
        'startEventId': start_event,
        'nodes': nodes,
        'sequenceFlows': seq_flows,
        'outgoing': outgoing,
        'incoming': incoming
    }


def _safe_parse_bpmn():
    try:
        return _parse_bpmn_sequence(), None
    except Exception as e:
        return None, str(e)


def _utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def _ensure_datasets_exist():
    """Create managed datasets in Flow if they don't exist yet."""
    project = dataiku.api_client().get_default_project()
    existing = {d["name"] for d in project.list_datasets()}

    def ensure(name, schema_cols):
        if name in existing:
            return
        ds = project.create_dataset(name, type="Filesystem")
        settings = ds.get_settings()
        # Basic schema
        settings.set_raw_schema({"columns": schema_cols})
        settings.save()

    ensure(
        SAMPLE_DETAILS_DS,
        [
            {"name": "session_id", "type": "string"},
            {"name": "sample_collection_location", "type": "string"},
            {"name": "sample_collection_time", "type": "string"},
        ],
    )

    ensure(
        PROCESS_ADHERENCE_DS,
        [
            {"name": "session_id", "type": "string"},
            {"name": "sampling_seconds", "type": "bigint"},
            {"name": "sanitized_60s", "type": "string"},
            {"name": "ppe_present", "type": "string"},
            {"name": "contamination_last_7_days", "type": "string"},
            {"name": "submitted_at", "type": "string"},
        ],
    )

    ensure(
        DEVIATION_DS,
        [
            {"name": "session_id", "type": "string"},
            {"name": "deviation", "type": "string"},
            {"name": "deviation_confirmed", "type": "string"},
            {"name": "sample_returned", "type": "string"},
            {"name": "submitted_at", "type": "string"},
        ],
    )


# Ensure datasets exist at startup
try:
    _ensure_datasets_exist()
except Exception as e:
    # Don't crash app init; surface via endpoints when called
    init_error = str(e)
else:
    init_error = None

@app.route('/bpmn_summary', methods=['GET'])
def bpmn_summary():
    bpmn, err = _safe_parse_bpmn()
    if err:
        return json.dumps({'error': err}), 500

    return json.dumps({
        'startEventId': bpmn['startEventId'],
        'nodeCount': len(bpmn['nodes']),
        'sequenceFlowCount': len(bpmn['sequenceFlows']),
        'startOutgoing': bpmn['outgoing'].get(bpmn['startEventId'], []) if bpmn['startEventId'] else []
    })
@app.route('/start_session', methods=['POST'])
def start_session():
    if init_error:
        return json.dumps({"error": init_error}), 500
    session_id = str(uuid.uuid4())
    return json.dumps({"session_id": session_id})


@app.route('/save_sample_collection_details', methods=['POST'])
def save_sample_collection_details():
    if init_error:
        return json.dumps({"error": init_error}), 500
    payload = request.get_json(force=True) or {}
    session_id = payload.get('session_id')
    location = payload.get('location')
    if not session_id or not location:
        return json.dumps({"error": "Missing session_id or location"}), 400

    ds = dataiku.Dataset(SAMPLE_DETAILS_DS)
    now = _utc_now_iso()
    with ds.get_writer() as w:
        w.write_row_dict({
            "session_id": session_id,
            "sample_collection_location": location,
            "sample_collection_time": now
        })

    return json.dumps({"ok": True, "sample_collection_time": now})


@app.route('/save_process_adherence', methods=['POST'])
def save_process_adherence():
    if init_error:
        return json.dumps({"error": init_error}), 500
    payload = request.get_json(force=True) or {}
    session_id = payload.get('session_id')
    if not session_id:
        return json.dumps({"error": "Missing session_id"}), 400

    required = ['sampling_seconds', 'sanitized_60s', 'ppe_present', 'contamination_last_7_days']
    for k in required:
        if payload.get(k) in (None, ""):
            return json.dumps({"error": f"Missing {k}"}), 400

    ds = dataiku.Dataset(PROCESS_ADHERENCE_DS)
    now = _utc_now_iso()
    with ds.get_writer() as w:
        w.write_row_dict({
            "session_id": session_id,
            "sampling_seconds": int(payload['sampling_seconds']),
            "sanitized_60s": payload['sanitized_60s'],
            "ppe_present": payload['ppe_present'],
            "contamination_last_7_days": payload['contamination_last_7_days'],
            "submitted_at": now
        })

    return json.dumps({"ok": True})


@app.route('/save_deviation', methods=['POST'])
def save_deviation():
    if init_error:
        return json.dumps({"error": init_error}), 500
    payload = request.get_json(force=True) or {}
    session_id = payload.get('session_id')
    if not session_id:
        return json.dumps({"error": "Missing session_id"}), 400

    ds = dataiku.Dataset(DEVIATION_DS)
    now = _utc_now_iso()
    with ds.get_writer() as w:
        w.write_row_dict({
            "session_id": session_id,
            "deviation": payload.get('deviation', ''),
            "deviation_confirmed": payload.get('deviation_confirmed', ''),
            "sample_returned": payload.get('sample_returned', ''),
            "submitted_at": now
        })

    return json.dumps({"ok": True})


@app.route('/save_sample_returned', methods=['POST'])
def save_sample_returned():
    if init_error:
        return json.dumps({"error": init_error}), 500
    payload = request.get_json(force=True) or {}
    session_id = payload.get('session_id')
    if not session_id:
        return json.dumps({"error": "Missing session_id"}), 400

    ds = dataiku.Dataset(DEVIATION_DS)
    now = _utc_now_iso()
    with ds.get_writer() as w:
        w.write_row_dict({
            "session_id": session_id,
            "deviation": payload.get('deviation', 'No'),
            "deviation_confirmed": payload.get('deviation_confirmed', ''),
            "sample_returned": payload.get('sample_returned', ''),
            "submitted_at": now
        })

    return json.dumps({"ok": True})


@app.route('/finalize_to_master_sample_data', methods=['POST'])
def finalize_to_master_sample_data():
    """Append latest sample details (time+location) and session_id to Snowflake table master_sample_data."""
    if init_error:
        return json.dumps({"error": init_error}), 500
    payload = request.get_json(force=True) or {}
    session_id = payload.get('session_id')
    if not session_id:
        return json.dumps({"error": "Missing session_id"}), 400

    # Get latest sample details for this session
    details = dataiku.Dataset(SAMPLE_DETAILS_DS).get_dataframe(limit=100000)
    df = details[details['session_id'] == session_id]
    if df.empty:
        return json.dumps({"error": "No sample collection details found for this session_id"}), 400

    # pick the most recent by time string
    df = df.sort_values('sample_collection_time')
    last = df.iloc[-1]

    # Append to Snowflake table (requires a dataset named master_sample_data pointing to that table)
    try:
        master = dataiku.Dataset("master_sample_data")
    except Exception as e:
        return json.dumps({"error": "Dataset 'master_sample_data' not found in this project. Please create a Snowflake dataset pointing to the master sample data table."}), 500

    with master.get_writer() as w:
        w.write_row_dict({
            "session_id": session_id,
            "sample_collection_location": str(last['sample_collection_location']),
            "sample_collection_time": str(last['sample_collection_time'])
        })

    return json.dumps({"ok": True})