#!/bin/bash

# =====================================================
# FleetIQ - AI Telematics Platform Startup Script
# =====================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║      🚀 FleetIQ AI Telematics Platform    ║"
echo "  ║         Starting all services...          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# === Kill ALL node processes that might hold our ports ===
echo -e "${YELLOW}[1/6] Cleaning up ports 3000 and 3001...${NC}"
# Kill by port
for port in 3000 3001; do
  pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
# Kill any leftover related processes
pkill -9 -f "nodemon.*server" 2>/dev/null || true
pkill -9 -f "react-scripts start" 2>/dev/null || true
pkill -9 -f "node.*server\.js" 2>/dev/null || true
sleep 2

# Double-check ports are truly free
for port in 3000 3001; do
  if lsof -ti :$port &>/dev/null; then
    echo -e "  ${RED}Port $port still occupied, force killing...${NC}"
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  echo -e "  ${GREEN}Port $port is free${NC}"
done

# === Check PostgreSQL ===
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"
if ! command -v psql &>/dev/null; then
  echo -e "  ${RED}PostgreSQL not found. Please install PostgreSQL.${NC}"
  exit 1
fi
if ! pg_isready -q 2>/dev/null; then
  echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
  sleep 2
fi
if ! psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw telematics_db; then
  echo -e "  ${YELLOW}Creating database telematics_db...${NC}"
  createdb telematics_db 2>/dev/null || psql -c "CREATE DATABASE telematics_db;" 2>/dev/null || true
fi
echo -e "  ${GREEN}PostgreSQL ready${NC}"

# === Install dependencies ===
echo -e "${YELLOW}[3/6] Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}Backend dependencies ready${NC}"

echo -e "${YELLOW}[4/6] Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}Frontend dependencies ready${NC}"

# === Seed database ===
echo -e "${YELLOW}[5/6] Seeding database...${NC}"
cd "$SCRIPT_DIR/backend"
node seeds/seed.js
echo -e "  ${GREEN}Database seeded${NC}"

# === Start services ===
echo -e "${YELLOW}[6/6] Starting services with hot reload...${NC}"

# Verify ports are still free right before starting
for port in 3000 3001; do
  if lsof -ti :$port &>/dev/null; then
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done

# Start backend (use node directly for stability, nodemon optional)
cd "$SCRIPT_DIR/backend"
node server.js 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:3001/api/health &>/dev/null; then
    echo -e "  ${GREEN}Backend is up on port 3001 (PID: $BACKEND_PID)${NC}"
    break
  fi
  sleep 1
done

# Start frontend
cd "$SCRIPT_DIR/frontend"
BROWSER=none PORT=3000 npm start 2>&1 &
FRONTEND_PID=$!
echo -e "  ${GREEN}Frontend starting on port 3000 (PID: $FRONTEND_PID)${NC}"

# Cleanup handler
cleanup() {
  echo -e "\n${RED}Shutting down FleetIQ...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  # Kill all children
  pkill -P $BACKEND_PID 2>/dev/null
  pkill -P $FRONTEND_PID 2>/dev/null
  for port in 3000 3001; do
    lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
  done
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ FleetIQ is running!                          ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Frontend:  http://localhost:3000                ║${NC}"
echo -e "${GREEN}║  Backend:   http://localhost:3001                ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Login:     admin@fleetiq.com / password123     ║${NC}"
echo -e "${GREEN}║                                                  ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

wait
