#!/bin/bash
cd ~/reality-check-ai/backend
if [ -f server.pid ]; then
    kill $(cat server.pid) && rm server.pid
    echo 'Server stopped'
else
    pkill uvicorn
    echo 'Server stopped (pkill)'
fi
