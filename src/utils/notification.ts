import { exec } from "child_process";
import { config } from "../config";
import os from "os";
import { DateTime } from "luxon";

/**
 * Play a speech notification with the given text
 * @param speech Optional custom text to speak, falls back to config value
 * @returns Promise resolving to true if successful
 */
export function playSound(speech?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const text = speech ? speech : config.token_buy.play_sound_text;
    const soundMethod = config.sound_notifications.sound_method || "auto";
    
    // If sound notifications are disabled
    if (soundMethod === "none") {
      console.log(`🔇 Sound notifications disabled`);
      resolve(false);
      return;
    }
    
    // Get current timestamp for logging
    const timestamp = DateTime.now().toFormat('HH:mm:ss');
    
    // Detect operating system
    const platform = os.platform();
    
    // Function to create a console beep
    const playBeep = () => {
      // Output 5 bell characters to create an audible beep in most terminals
      console.log('\u0007\u0007\u0007\u0007\u0007');
      console.log(`🔊 [${timestamp}] Console bell sound played: "${text}"`);
      resolve(true);
      return true;
    };
    
    // Function to show desktop notification
    const showNotification = () => {
      if (platform === "linux") {
        exec('which notify-send', (err, stdout) => {
          if (!err && stdout) {
            // If notify-send is available, use it
            const notifyCmd = `notify-send -u critical "SniperV2 Alert" "${text}"`;
            exec(notifyCmd);
            console.log(`🔔 [${timestamp}] Desktop notification shown: "${text}"`);
            resolve(true);
            return true;
          } else {
            console.log(`🔔 [${timestamp}] Desktop notification not available, falling back to beep`);
            return playBeep();
          }
        });
      } else {
        console.log(`🔔 [${timestamp}] Desktop notifications only supported on Linux`);
        return playBeep();
      }
    };
    
    // Function to play speech
    const playSpeech = () => {
      let command;
      
      if (platform === "win32") {
        // Windows implementation using PowerShell
        command = `powershell -Command "(New-Object -com SAPI.SpVoice).speak('${text}')"`;
      } else if (platform === "linux") {
        // Linux/WSL2 implementation using spd-say with a timeout
        command = `timeout 2s spd-say -r -10 -p 30 "${text}" 2>/dev/null || echo "spd-say failed"`;
      } else {
        // For macOS or other platforms - not supported
        console.log(`🔊 [${timestamp}] Speech synthesis not supported on this platform: ${platform}`);
        return playBeep();
      }
      
      exec(command, (error, stdout, stderr) => {
        if (error || stderr || (stdout && stdout.includes("failed"))) {
          console.log(`🔊 [${timestamp}] Speech synthesis failed, falling back to console beep`);
          playBeep();
        } else {
          console.log(`🔊 [${timestamp}] Speech sound played: "${text}"`);
          resolve(true);
        }
      });
      
      return true;
    };
    
    // Based on the configured sound method, use the appropriate function
    switch (soundMethod) {
      case "beep":
        playBeep();
        break;
      case "notify":
        showNotification();
        break;
      case "speech":
        playSpeech();
        break;
      case "auto":
      default:
        // Auto mode: try speech first, then notification, then beep
        if (platform === "win32") {
          playSpeech(); // Windows usually has speech synthesis available
        } else if (platform === "linux") {
          // For Linux, try notify-send first which is more reliable
          exec('which notify-send', (err, stdout) => {
            if (!err && stdout) {
              showNotification();
            } else {
              playSpeech();
            }
          });
        } else {
          // For other platforms, fallback to beep
          playBeep();
        }
        break;
    }
  });
}
