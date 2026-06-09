import asyncio, sys
sys.path.insert(0, '.')
from app.api.resource import _strip_think

test_text = '<think>reasoning content here</think>\n\nOutput text\n\n---JSON_DATA---\n{"exercises": []}'
result = _strip_think(test_text)
print('Has think in output:', '<think>' in result)
print('Result:', repr(result))

# Also test token-by-token to simulate streaming
tokens = ['<think>The', ' user', ' wants', '</think>', '\n\nOut', 'put']
stream_text = ''
for tk in tokens:
    stream_text += tk
    display = _strip_think(stream_text)
    print(f'  token={tk!r:15s} -> display={display!r}')
