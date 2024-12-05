# app.py
from flask import Flask, render_template, request, jsonify, session
import openai
import os
import json
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from datetime import datetime
import difflib
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Set a secret key for session management

DEFAULT_SAVE_PATH = r"C:\Users\rober\OneDrive\Pictures\Documents\Life\VoiceNotes.md"

DEFAULT_USER_PROMPT = ""  # Empty string by default


DEFAULT_SYSTEM_PROMPT = """You are an advanced AI assistant capable of providing various types of responses based on 
the input and conversation history. Your capabilities include answering questions, suggesting research topics, 
offering advice, providing insights, generating ideas, summarizing information, explaining complex topics, 
identifying patterns, and all other capabilities relevant to assisting the user. Adapt your response style 
to best suit the nature of the input and the identified response type. Ensure your responses are helpful, 
accurate, insightful, and tailored to the specific needs implied by the input and the ongoing conversation."""


# Set your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route('/')
def index():
    return render_template('index.html')






















@app.route('/save_api_key', methods=['POST'])
def save_api_key():
    data = request.json
    new_api_key = data.get('api_key')
    
    if not new_api_key:
        return jsonify({'error': 'No API key provided'}), 400
    
    # Update the API key in the environment
    os.environ['OPENAI_API_KEY'] = new_api_key
    openai.api_key = new_api_key
    
    # Optionally, you can save the API key to a secure storage or configuration file
    # Be cautious about storing API keys in plain text
    
    return jsonify({'message': 'API key updated successfully'})


























@app.route('/process_audio', methods=['POST'])
def process_audio():
    audio_file = request.files['audio_data']
    filename = secure_filename(audio_file.filename)
    audio_path = os.path.join('uploads', filename)
    audio_file.save(audio_path)

    try:
        # Transcribe audio
        transcription = openai.Audio.transcribe("whisper-1", open(audio_path, "rb"))
        transcribed_text = transcription['text']

        # Get conversation history from the request
        conversation = json.loads(request.form.get('conversation', '[]'))

        # Get custom prompts
        system_prompt = request.form.get('system_prompt') or session.get('system_prompt', DEFAULT_SYSTEM_PROMPT)
        user_prompt = request.form.get('user_prompt') or session.get('user_prompt', DEFAULT_USER_PROMPT)

        full_user_message = f"{user_prompt}\n\n{transcribed_text}" if user_prompt else transcribed_text

        # Generate AI response
        ai_response = generate_ai_response(full_user_message, conversation, system_prompt)

        # Update conversation history
        conversation.append({"role": "user", "content": full_user_message})
        conversation.append({"role": "assistant", "content": ai_response})

        return jsonify({
            'transcription': transcribed_text,
            'suggestions': ai_response,
            'message': 'Audio processed successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        os.remove(audio_path)  # Clean up the saved file




















@app.route('/end_conversation', methods=['POST'])
def end_conversation():
    data = request.json
    conversation = data.get('conversation', [])
    
    if not conversation:
        return jsonify({'error': 'No conversation to save'}), 400

    try:
        # Format conversation in Markdown
        markdown_content = format_conversation_markdown(conversation)

        # Use the custom save path or default if not set
        save_path = session.get('save_path', DEFAULT_SAVE_PATH)
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # Save to the specified path
        with open(save_path, 'a', encoding='utf-8') as f:
            f.write(markdown_content)

        return jsonify({'message': 'Conversation saved successfully'})

    except Exception as e:
        return jsonify({'error': f'Failed to save conversation: {str(e)}'}), 500




















@app.route('/get_save_path', methods=['GET'])
def get_save_path():
    return jsonify({
        'save_path': session.get('save_path', DEFAULT_SAVE_PATH)
    })

@app.route('/save_save_path', methods=['POST'])
def save_save_path():
    data = request.json
    new_save_path = data.get('save_path', DEFAULT_SAVE_PATH)
    
    # Validate the new save path
    if not os.path.exists(os.path.dirname(new_save_path)):
        return jsonify({'error': 'Invalid save path. Directory does not exist.'}), 400
    
    session['save_path'] = new_save_path
    return jsonify({'message': 'Save path updated successfully'})





















def generate_ai_response(transcribed_text, conversation, system_prompt):
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation)
    
    messages.append({"role": "user", "content": transcribed_text})

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages
        )
        return response.choices[0].message['content']
    except Exception as e:
        print(f"Error in AI response generation: {str(e)}")
        return "I apologize, but I encountered an error while processing your request."



















def format_conversation_markdown(conversation):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    markdown_content = f"# Voice Note {timestamp}\n\n"

    for message in conversation:
        role = "You" if message["role"] == "user" else "AI"
        markdown_content += f"## {role}:\n{message['content']}\n\n"

    markdown_content += "---\n\n"
    return markdown_content

















@app.route('/get_prompts', methods=['GET'])
def get_prompts():
    return jsonify({
        'system_prompt': session.get('system_prompt', DEFAULT_SYSTEM_PROMPT),
        'user_prompt': session.get('user_prompt', DEFAULT_USER_PROMPT)
    })

@app.route('/save_prompts', methods=['POST'])
def save_prompts():
    data = request.json
    session['system_prompt'] = data.get('system_prompt', DEFAULT_SYSTEM_PROMPT)
    session['user_prompt'] = data.get('user_prompt', DEFAULT_USER_PROMPT)
    return jsonify({'message': 'Prompts saved successfully'})






















if __name__ == '__main__':
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    app.run(debug=True)