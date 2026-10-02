#!/usr/bin/env bash
# Stops the one-port dev server (8080) and its GP app (3410). Touches only those two ports.
for port in 8080 3410; do
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then kill $pids && echo "Stopped port $port (pid $pids)"; else echo "Port $port: nothing running"; fi
done
