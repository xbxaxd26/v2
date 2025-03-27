#!/bin/bash

echo "🚀 Starting Token Sniper Performance Comparison"
echo "==================================================="
echo "This will run two instances of the token sniper, one with Helius and one with Shyft"
echo "Press Ctrl+C to stop all instances when you're done"
echo "==================================================="

# Change to the project directory
cd "$(dirname "$0")"

# Make sure environment files exist
if [ ! -f .env.helius ] || [ ! -f .env.shyft ]; then
  echo "Error: Missing environment files. Please create .env.helius and .env.shyft"
  exit 1
fi

# Function to get available terminal emulator
get_terminal() {
  if command -v gnome-terminal &> /dev/null; then
    echo "gnome-terminal"
  elif command -v xterm &> /dev/null; then
    echo "xterm"
  elif command -v konsole &> /dev/null; then
    echo "konsole"
  else
    echo "none"
  fi
}

# Modify the environment files to ensure proper provider prioritization
# Ensure Helius is prioritized in .env.helius
if ! grep -q "PROVIDER=HELIUS" .env.helius; then
  echo "PROVIDER=HELIUS" >> .env.helius
fi

# Ensure Shyft is prioritized in .env.shyft
if ! grep -q "PROVIDER=SHYFT" .env.shyft; then
  echo "PROVIDER=SHYFT" >> .env.shyft
fi

# For Windows/WSL with separate cmd.exe windows
run_windows_terminals() {
  echo "Starting Helius terminal..."
  cmd.exe /c start cmd.exe /k "cd $(wslpath -w "$(pwd)") && npm run dev:helius"
  
  sleep 2
  
  echo "Starting Shyft terminal..."
  cmd.exe /c start cmd.exe /k "cd $(wslpath -w "$(pwd)") && npm run dev:shyft"
}

# For Unix terminals
run_unix_terminals() {
  terminal=$(get_terminal)
  
  if [ "$terminal" == "none" ]; then
    echo "No supported terminal found. Running in current terminal with split screen."
    echo "Press Ctrl+C to stop all instances."
    
    # Run both in background with output to separate log files
    echo "Starting Helius instance (output to helius.log)..."
    DOTENV_CONFIG_PATH=.env.helius PROVIDER=HELIUS npm run dev > helius.log 2>&1 &
    HELIUS_PID=$!
    
    echo "Starting Shyft instance (output to shyft.log)..."
    DOTENV_CONFIG_PATH=.env.shyft PROVIDER=SHYFT npm run dev > shyft.log 2>&1 &
    SHYFT_PID=$!
    
    # Function to kill processes on exit
    cleanup() {
      echo "Stopping all instances..."
      kill $HELIUS_PID $SHYFT_PID 2>/dev/null
      exit 0
    }
    
    # Set up trap for Ctrl+C
    trap cleanup INT TERM
    
    # Display logs in real-time with tail
    if command -v tail &> /dev/null; then
      echo "Displaying logs (Ctrl+C to exit):"
      tail -f helius.log shyft.log
    else
      echo "Log files will be written to helius.log and shyft.log"
      wait
    fi
  else
    # Open separate terminal windows
    case "$terminal" in
      "gnome-terminal")
        gnome-terminal --title="Token Sniper - Helius" -- bash -c "DOTENV_CONFIG_PATH=.env.helius PROVIDER=HELIUS npm run dev; exec bash"
        gnome-terminal --title="Token Sniper - Shyft" -- bash -c "DOTENV_CONFIG_PATH=.env.shyft PROVIDER=SHYFT npm run dev; exec bash"
        ;;
      "xterm")
        xterm -title "Token Sniper - Helius" -e "DOTENV_CONFIG_PATH=.env.helius PROVIDER=HELIUS npm run dev; exec bash" &
        xterm -title "Token Sniper - Shyft" -e "DOTENV_CONFIG_PATH=.env.shyft PROVIDER=SHYFT npm run dev; exec bash" &
        ;;
      "konsole")
        konsole --new-tab -p tabtitle="Token Sniper - Helius" -e bash -c "DOTENV_CONFIG_PATH=.env.helius PROVIDER=HELIUS npm run dev; exec bash" &
        konsole --new-tab -p tabtitle="Token Sniper - Shyft" -e bash -c "DOTENV_CONFIG_PATH=.env.shyft PROVIDER=SHYFT npm run dev; exec bash" &
        ;;
    esac
    
    echo "Terminal windows have been opened."
    echo "Please manually close them when you're done with the comparison."
  fi
}

# Update package.json to add our custom scripts
if ! grep -q "dev:helius" package.json; then
  # Use sed to add new scripts before the closing brace of the "scripts" section
  sed -i '/\"scripts\": {/,/}/ s/}$/,\n    "dev:helius": "DOTENV_CONFIG_PATH=.env.helius PROVIDER=HELIUS ts-node src\/index.ts",\n    "dev:shyft": "DOTENV_CONFIG_PATH=.env.shyft PROVIDER=SHYFT ts-node src\/index.ts"\n  }/' package.json
  echo "Added new npm scripts to package.json"
fi

# Detect if we're running in WSL
if grep -q Microsoft /proc/version; then
  echo "Detected WSL environment. Starting Windows terminals..."
  run_windows_terminals
else
  echo "Starting Unix terminals..."
  run_unix_terminals
fi

echo "Performance comparison started!"
echo "Watch both windows to compare how quickly they detect liquidity pools and tokens."
echo "Note the timestamps in each window to determine which provider is faster." 