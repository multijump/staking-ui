### Amount Bought (sell order)

For sell orders (exact input), the amount bought (output) is calculated:

```
// Sell ETH for ERC20
const inputAmount = userInputEthValue
const inputReserve = web3.eth.getBalance(exchangeAddress)
const outputReserve = tokenContract.methods.balanceOf(exchangeAddress).call()

// Sell ERC20 for ETH
const inputAmount = userInputTokenValue
const inputReserve = tokenContract.methods.balanceOf(exchangeAddress).call()
const outputReserve = web3.eth.getBalance(exchangeAddress)

// Output amount bought
const numerator = inputAmount * outputReserve * 997
const denominator = inputReserve * 1000 + inputAmount * 997
const outputAmount = numerator / denominator
```

### Amount Sold (buy order)

For buy orders (exact output), the cost (input) is calculated:

```
// Buy ERC20 with ETH
const outputAmount = userInputTokenValue
const inputReserve = web3.eth.getBalance(exchangeAddress)
const outputReserve = tokenContract.methods.balanceOf(exchangeAddress).call()

// Buy ETH with ERC20
const outputAmount = userInputEthValue
const inputReserve = tokenContract.methods.balanceOf(exchangeAddress).call()
const outputReserve = web3.eth.getBalance(exchangeAddress)

// Cost
const numerator = outputAmount * inputReserve * 1000
const denominator = (outputReserve - outputAmount) * 997
const inputAmount = numerator / denominator + 1
```
