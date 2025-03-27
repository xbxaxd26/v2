import { buyToken } from "../utils/handlers/sniperooHandler";

/**
 * Simple test function for the buyToken functionality
 */
const tokenAddress = ""; // Replace with a real token address for testing
const amount = 0.01; // Small amount for testing
const sell = false; // Auto-sell disabled for testing
const tp = 50; // Take profit percentage
const sl = 15; // Stop loss percentage

async function testBuyToken(): Promise<void> {
  console.log("=== Testing Sniperoo buyToken Function ===");

  // Test case 1: Valid parameters
  try {
    console.log("\nTest 1: Valid parameters");
    console.log("Buying token with valid parameters...");
    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Amount: ${amount} SOL`);
    console.log(`Auto-Sell: ${sell ? "Enabled" : "Disabled"}`);
    if (sell) {
      console.log(`Take Profit: ${tp}%, Stop Loss: ${sl}%`);
    }
    const result = await buyToken(tokenAddress, amount, sell, tp, sl);
    console.log(`Result: ${result ? "SUCCESS ✅" : "FAILED ❌"}`);
  } catch (error) {
    console.error("Test 1 Error:", error instanceof Error ? error.message : "Unknown error");
  }

  // Test case 2: Invalid token address
  try {
    console.log("\nTest 2: Invalid token address");
    console.log("Buying token with empty address...");
    const result = await buyToken("", 0.01, sell, tp, sl);
    console.log(`Result: ${result ? "SUCCESS ✅" : "FAILED ❌"}`);
  } catch (error) {
    console.log(`Error caught as expected: ${error instanceof Error ? error.message : "Unknown error"} ✅`);
  }

  // Test case 3: Invalid amount
  try {
    console.log("\nTest 3: Invalid amount");
    console.log("Buying token with zero amount...");
    const testTokenAddress = "YOUR_TEST_TOKEN_ADDRESS"; // Replace with a real token address
    const result = await buyToken(testTokenAddress, 0, sell, tp, sl);
    console.log(`Result: ${result ? "SUCCESS ✅" : "FAILED ❌"}`);
  } catch (error) {
    console.log(`Error caught as expected: ${error instanceof Error ? error.message : "Unknown error"} ✅`);
  }

  // Test case 4: Auto-sell enabled with valid parameters
  try {
    console.log("\nTest 4: Auto-sell enabled with valid parameters");
    console.log("Buying token with auto-sell enabled...");
    const testSell = true;
    const result = await buyToken(tokenAddress, amount, testSell, tp, sl);
    console.log(`Result: ${result ? "SUCCESS ✅" : "FAILED ❌"}`);
  } catch (error) {
    console.error("Test 4 Error:", error instanceof Error ? error.message : "Unknown error");
  }

  console.log("\n=== Test Complete ===");
}

// Run the test
testBuyToken().catch((error) => {
  console.error("Unhandled error in test:", error);
});
