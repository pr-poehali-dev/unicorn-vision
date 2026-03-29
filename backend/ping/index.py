import json
import subprocess
import platform
# ping service v2

def handler(event: dict, context) -> dict:
    """Пингует список IP-адресов и возвращает статус доступности каждого."""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    body = json.loads(event.get('body') or '{}')
    devices = body.get('devices', [])

    results = []
    for device in devices:
        ip = device.get('ip', '').strip()
        name = device.get('name', ip)
        if not ip:
            continue

        param = '-n' if platform.system().lower() == 'windows' else '-c'
        try:
            result = subprocess.run(
                ['ping', param, '1', '-W', '1', ip],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3
            )
            online = result.returncode == 0
        except Exception:
            online = False

        results.append({'ip': ip, 'name': name, 'online': online})

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'results': results})
    }