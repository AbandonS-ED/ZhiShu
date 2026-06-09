import asyncio, httpx, json

async def test():
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream('POST', 'http://localhost:8001/api/v1/resource/exercises/generate/stream', json={
            'student_id': '00000000-0000-0000-0000-000000000001',
            'knowledge_point': '搜索算法',
            'count': 2,
            'exercise_type': 'all'
        }) as resp:
            print('Status:', resp.status_code)
            buffer = ''
            event_count = 0
            token_count = 0
            think_seen = False
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
                                c = data.get('content','') or ''
                                if t == 'token':
                                    token_count += 1
                                    if '<think>' in c:
                                        think_seen = True
                                    if token_count <= 3:
                                        print(f'TOKEN#{token_count}: {c[:80]}')
                                elif t == 'progress':
                                    pass
                                elif t == 'result':
                                    exs = data.get('data',{}).get('exercises',[])
                                    print(f'RESULT: {len(exs)} exercises')
                                elif t == 'done':
                                    print(f'DONE - events={event_count}, tokens={token_count}, think_in_tokens={think_seen}')
                                elif t == 'error':
                                    print(f'ERROR: {c}')
                            except Exception as e:
                                pass
            if token_count == 0:
                print('WARNING: no token events!')

asyncio.run(test())
