#!/usr/bin/env python3
# Flask Hello World - Web 服务器
from flask import Flask, request, jsonify

app = Flask(__name__)

# 路由
@app.route('/')
def hello():
    return 'Hello, World!'

@app.route('/greet')
def greet():
    name = request.args.get('name', 'World')
    return f'Hello, {name}!'

@app.route('/api/greet', methods=['GET', 'POST'])
def api_greet():
    if request.method == 'GET':
        name = request.args.get('name', 'World')
    else:
        data = request.get_json()
        name = data.get('name', 'World')

    return jsonify({
        'message': f'Hello, {name}!',
        'status': 'success'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)