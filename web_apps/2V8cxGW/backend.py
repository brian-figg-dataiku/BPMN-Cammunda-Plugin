import dataiku
from flask import request, jsonify
import json

# Initialize the folder connection
folder = dataiku.Folder("YOUR_FOLDER_ID")
FILE_NAME = "process.bpmn"

@app.route('/save', methods=['POST'])
def save_bpmn():
    data = request.get_json()
    xml_content = data.get('xml')
    
    # This overwrites the existing file. 
    # For versioning, you could append a timestamp to FILE_NAME here.
    folder.upload_stream(FILE_NAME, xml_content.encode('utf-8'))
    
    return jsonify({"status": "success"})

@app.route('/load', methods=['GET'])
def load_bpmn():
    try:
        with folder.get_download_stream(FILE_NAME) as stream:
            xml_content = stream.read().decode('utf-8')
        return jsonify({"xml": xml_content})
    except Exception as e:
        return jsonify({"error": "No existing diagram found"}), 404
