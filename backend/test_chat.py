import asyncio, httpx, json

async def test():
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream('POST', 'http://localhost:8001/api/v1/chat/stream', json={
            'student_id': '00000000-0000-0000-0000-000000000001',
            'message': '出 5 道搜索算法练习题',
        }) as resp:
            print('Status:', resp.status_code)
            buffer = ''
            event_count = 0
            token_count = 0
            think_seen = False
            token_contents = []
            async for chunk in resp.aiter_text():
                buffer += chunk
                while '\n\n' in buffer:
                    part, buffer = buffer.split('\n\n', 1)
                    for line in part.split('\n'):
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[6:])
                                event_count += 1
                                t = data.get('type','')
                                c = data.get('content','') or data.get('message','') or ''
                                if t == 'token':
                                    token_count += 1
                                    if '<think>' in c:
                                        think_seen = True
                                    if token_count <= 5:
                                        token_contents.append(c[:60])
                                        print(f'TOKEN#{token_count}: {c[:80]}')
                                elif t == 'progress':
                                    print(f'PROGRESS: {c[:80]}')
                                elif t == 'result':
                                    print(f'RESULT: {json.dumps(data.get("data",{}))[:100]}')
                                elif t == 'done':
                                    print(f'DONE - events={event_count}, tokens={token_count}, think_in_tokens={think_seen}')
                                elif t == 'error':
                                    print(f'ERROR: {c}')
                                elif t == 'session':
                                    print(f'SESSION: {data.get("session_id")}')
                            except Exception as e:
                                pass
            if token_count == 0:
                print('WARNING: no token events!')

asyncio.run(test())
