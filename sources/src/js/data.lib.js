"use strict";
const NETWORK = 1;

const tokenFields = `{
    id
    name
    symbol
    totalSupply
    derivedETH
}`;

const factoryFields = `{
  volumeUSD
  volumeETH
  untrackedVolumeUSD
  liquidityUSD
  liquidityETH
  txCount
  tokenCount
  userCount
}`;

const pairFields = `{
    id
    reserveUSD
    reserveETH
    volumeUSD
    untrackedVolumeUSD
    trackedReserveETH
    token0 ${tokenFields}
    token1 ${tokenFields}
    reserve0
    reserve1
    token0Price
    token1Price
    totalSupply
    txCount
    timestamp
}`;

const blockFields = `{
    id
    number
    timestamp
}`;

const tokenFullFields = `{
    id
    symbol
    name
    decimals
    totalSupply
    volume
    volumeUSD
    untrackedVolumeUSD
    txCount
    liquidity
    derivedETH
    basePairs ${pairFields}
    quotePairs ${pairFields}
}`;

const globalFailed = function (error) {
  console.log("Failed!!!", error);
};

const globalSuccess = function (data) {
  console.log("Suucess!!!", data);
};

function makeGraphQLRequest(
  url,
  params,
  method = "post",
  success = null,
  failed = null
) {
  $.ajax({
    url,
    method,
    data: JSON.stringify(params),
    dataType: "json",
    success: function (response) {
      if (response.data) {
        if (success) {
          success(response.data);
        } else {
          globalSuccess(response.data);
        }
      } else {
        globalFailed();
      }
    },
    error: failed ? failed : globalFailed,
  });
}

async function getPool(id) {
  const { MASTERCHEF_URL } = window.variables.URLS || values[NETWORK].URLS;
  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      MASTERCHEF_URL,
      {
        query: `
                query(
                    $id: ID!
                    ) {
                        pools(
                            id: $id
                        ) {
                            id
                            pair
                            allocPoint
                            lastRewardBlock
                            accSwipePerShare
                            balance
                            userCount
                            owner {
                                id
                                swipePerBlock
                                totalAllocPoint
                            }
                            users(orderBy: amount, orderDirection: desc) {
                                id
                                address
                                amount
                                rewardDebt
                            }
                            slpAge
                            liquidityPair @client
                            timestamp
                            entryUSD
                            exitUSD
                        }
                    }
            `,
        variables: {
          id,
        },
      },
      "post",
      function (data) {
        return resolve(data.pools);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

function getPools() {
  let { FACTORY_CONTRACT, ACCOUNT } = window.variables;

  return Promise.all([
    call(FACTORY_CONTRACT.methods.poolLength)(),
  ]).then(([poolLength]) => {
    let poolIds = [];
    for (let i = 0; i < poolLength; i += 1) {
      poolIds.push(i);
    }
    return Promise.all(
      poolIds.map((pid) => {
        return Promise.all([
          Promise.resolve(pid),
          call(FACTORY_CONTRACT.methods.poolInfo)(pid),
          ACCOUNT ? call(FACTORY_CONTRACT.methods.userInfo)(pid, ACCOUNT) : Promise.resolve({ amount: 0, rewardDebt: 0 }),
        ]);
      })
    )
      .then((poolInfos) => {
        const pools = poolInfos.map(([poolId, info, user]) => {
          return {
            id: poolId.toString(),
            secondaryTokensPerDay: info.secondaryTokensPerDay,
            lastUpdateTime: info.lastUpdateTime,
            maxStake: info.maxStake,
            token: info.token.toLowerCase(),
            accSecondaryTokenPerShare: info.accSecondaryTokenPerShare,
            balance: user.amount,
            rewardDebt: user.rewardDebt
          };
        });
        return pools;
      })
      .catch(console.log);
  });
}

async function getLiquidityPositions() {
  const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS;
  const { ACCOUNT } = window.variables;
  if (ACCOUNT) {
    return new Promise((resolve, reject) => {
      makeGraphQLRequest(
        SWIPE_SWAP_URL,
        {
          query: `
                  query(
                      $first: Int! = 1000,
                      $user: Bytes!
                      ) {
                          liquidityPositions(first: $first, where: { user: $user }) {
                              id
                              liquidityTokenBalance
                              user {
                                  id
                              }
                              pair {
                                  id
                              }
                          }
                      }
              `,
          variables: {
            user: ACCOUNT.toLowerCase(),
          },
        },
        "post",
        function (data) {
          return resolve(data.liquidityPositions);
        },
        function (error) {
          return reject(error);
        }
      );
    });
  } else {
    return new Promise((resolve, reject) => {
      return resolve([]);
    });
  }
}

function getPairs(pairAddresses, url = null) {
  const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS;

  if (!url) {
    url = SWIPE_SWAP_URL;
  }
  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      url,
      {
        query: `
                query(
                    $first: Int! = 1000
                    $pairAddresses: [Bytes]!
                    $orderBy: String! = "trackedReserveETH"
                    $orderDirection: String! = "desc"
                ) {
                    pairs(
                        first: $first
                        orderBy: $orderBy
                        orderDirection: $orderDirection
                        where: { id_in: $pairAddresses }
                    ) ${pairFields}
                }
            `,
        variables: {
          pairAddresses,
        },
      },
      "post",
      function (data) {
        return resolve(data.pairs);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

function getFullPairs(offset = 0, limit = 1000, url = null) {
  if (!url) {
    const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS;
    url = SWIPE_SWAP_URL;
  }

  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      url,
      {
        query: `
                query(
                    $first: Int! = 1000
                    $offset: Int! = 0
                    $orderBy: String! = "timestamp"
                    $orderDirection: String! = "desc"
                ) {
                    pairs(
                        first: $first
                        skip: $offset
                        orderBy: $orderBy
                        orderDirection: $orderDirection
                    ) ${pairFields}
                }
            `,
        variables: {
          first: limit,
          offset,
        },
      },
      "post",
      function (data) {
        return resolve(data.pairs);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

function getPair(pair) {
  const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS;
  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      SWIPE_SWAP_URL,
      {
        query: `
                query(
                    $id: ID!
                ) {
                    pairs(
                        where: { id: $id }
                    ) ${pairFields}
                }
            `,
        variables: {
          id: pair.toLowerCase(),
        },
      },
      "post",
      function (data) {
        return resolve(data.pairs);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

function getAverageBlockTime(url = null) {
  const now = dateFns.startOfSecond(
    dateFns.startOfMinute(dateFns.startOfHour(Date.now()))
  );
  const start = dateFns.getTime(dateFns.subHours(now, 6)) / 1000;
  const end = dateFns.getTime(now) / 1000;
  const { BLOCK_URL } = window.variables.URLS || values[NETWORK].URLS;

  if (!url) {
    url = BLOCK_URL
  }

  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      url,
      {
        query: `
                query(
                    $first: Int! = 1000
                    $skip: Int! = 0
                    $start: Int!
                    $end: Int!
                ) {
                    blocks(
                        first: $first
                        skip: $skip
                        orderBy: number
                        orderDirection: desc
                        where: { timestamp_gt: $start, timestamp_lt: $end, number_gt: 9300000 }
                    ) ${blockFields}
                }
            `,
        variables: {
          start,
          end,
        },
      },
      "post",
      function (data) {
        const blocks = data.blocks;
        const averageBlockTime = blocks.reduce(
          (previousValue, currentValue, currentIndex) => {
            if (previousValue.timestamp) {
              const difference =
                previousValue.timestamp - currentValue.timestamp;
              previousValue.difference = previousValue.difference + difference;
            }

            previousValue.timestamp = currentValue.timestamp;

            if (currentIndex === blocks.length - 1) {
              return previousValue.difference / blocks.length;
            }

            return previousValue;
          },
          { timestamp: null, difference: 0 }
        );

        return resolve(averageBlockTime);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

async function getToken(id, url = null) {
  const oneDayBlock = { number: 5546330 };
  const twoDayBlock = { number: 5546330 };
  const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS || {};

  if (!url) {
    url = SWIPE_SWAP_URL;
  }

  return Promise.all([
    new Promise((resolve, reject) => {
      makeGraphQLRequest(
        url,
        {
          query: `
                    query(
                        $id: String!
                    ) {
                        token(
                            id: $id
                        ) ${tokenFullFields}
                    }
                `,
          variables: {
            id: id.toLowerCase(),
          },
        },
        "post",
        function (data) {
          return resolve(data.token);
        },
        function (error) {
          return reject(error);
        }
      );
    }),
    new Promise((resolve, reject) => {
      makeGraphQLRequest(
        url,
        {
          query: `
                    query(
                        $id: String!, $block: Block_height!
                    ) {
                        token(
                            id: $id, block: $block
                        ) ${tokenFullFields}
                    }
                `,
          variables: {
            id,
            block: oneDayBlock,
          },
        },
        "post",
        function (data) {
          return resolve(data.token);
        },
        function (error) {
          return reject(error);
        }
      );
    }),
    new Promise((resolve, reject) => {
      makeGraphQLRequest(
        url,
        {
          query: `
                    query(
                        $id: String!, $block: Block_height!
                    ) {
                        token(
                            id: $id, block: $block
                        ) ${tokenFullFields}
                    }
                `,
          variables: {
            id,
            block: twoDayBlock,
          },
        },
        "post",
        function (data) {
          return resolve(data.token);
        },
        function (error) {
          return reject(error);
        }
      );
    }),
  ])
    .then(function ([token, oneDayToken, twoDayToken]) {
      return {
        ...token,
        oneDay: {
          volumeUSD: String(oneDayToken?.volumeUSD),
          derivedETH: String(oneDayToken?.derivedETH),
          liquidity: String(oneDayToken?.liquidity),
          txCount: String(oneDayToken?.txCount),
        },
        twoDay: {
          volumeUSD: String(twoDayToken?.volumeUSD),
          derivedETH: String(twoDayToken?.derivedETH),
          liquidity: String(twoDayToken?.liquidity),
          txCount: String(twoDayToken?.txCount),
        },
      };
    })
    .catch(function (error) {
      return {};
    });
}

function getEthPrice(url = null) {
  const { SWIPE_SWAP_URL } = window.variables.URLS || values[NETWORK].URLS;

  if (!url) {
    url = SWIPE_SWAP_URL;
  }

  return new Promise((resolve, reject) => {
    makeGraphQLRequest(
      url,
      {
        query: `
                query(
                    $id: Int! = 1
                ) {
                    bundles(
                        id: $id
                    ) {
                        id
                        ethPrice
                    }
                }
            `,
      },
      "post",
      function (data) {
        return resolve(data.bundles);
      },
      function (error) {
        return reject(error);
      }
    );
  });
}

function getPoolUser(id) {
  let { FACTORY_CONTRACT } = window.variables;

  return Promise.all([
    call(FACTORY_CONTRACT.methods.poolLength)(),
  ]).then(([poolLength]) => {
    let poolIds = [];
    for (let i = 0; i < poolLength; i += 1) {
      poolIds.push(i);
    }
    return Promise.all(
      poolIds.map((pid) => {
        return Promise.all([
          Promise.resolve(pid),
          id ? call(FACTORY_CONTRACT.methods.userInfo)(pid, id) : Promise.resolve({ amount: 0, rewardDebt: 0 }),
        ]);
      })
    )
      .then((userInfos) => {
        const pools = userInfos.map(([poolId, user]) => {
          return {
            amount: user.amount,
            rewardDebt: user.rewardDebt
          };
        });
        return pools;
      })
      .catch(console.log);
  });
}

function getPairTokenContract(address) {
  if (!web3) return null;

  return new web3.eth.Contract(
    window.variables.CONTRACT_PAIR_TOKEN_ABI,
    address
  );
}

function convertFromWei(value) {
  return web3.utils.fromWei(value, "ether");
}

function convertToWei(value) {
  return web3.utils.toWei(value, "ether");
}

function getAllowances(address, pools) {
  const { FACTORY_CONTRACT, PAIR_TOKEN_CONTRACTS } = window.variables;
  return new Promise((resolve, reject) => {
    Promise.all(
      pools.map((pool) => {
        return Promise.all([
          Promise.resolve(pool.token),
          call(PAIR_TOKEN_CONTRACTS[toChecksumAddress(pool.token)].methods.allowance)(
            address,
            window.variables.CONTRACT_FACTORY_ADDRESS
          ),
          call(FACTORY_CONTRACT.methods.pendingSecondaryToken)(pool.id, address),
          call(PAIR_TOKEN_CONTRACTS[toChecksumAddress(pool.token)].methods.balanceOf)(address),
        ]);
      })
    )
      .then((results) => {
        const pairs = results.reduce(
          (a, [pair, allowance, reward, balance]) => ({
            ...a,
            [pair]: {
              allowance: Number(web3.utils.fromWei(allowance, "ether")),
              reward: Number(web3.utils.fromWei(reward, "ether")),
              balance: web3.utils.fromWei(balance, "ether"),
            },
          }),
          {}
        );
        resolve(pairs);
      })
      .catch(reject);
  });
}

function getBalance(address, pairContract) {
  const { MASTERCHEF_CONTRACT } = window.variables;

  return Promise.all([call(pairContract.methods.balanceOf)(address)]);
}

function getBalances(address, pairs) {
  const { PAIR_TOKEN_CONTRACTS } = window.variables;
  return new Promise((resolve, reject) => {
    Promise.all(
      pairs.map((pair) => {
        return Promise.all([
          Promise.resolve(pair.id),
          call(PAIR_TOKEN_CONTRACTS[pair.id].methods.balanceOf)(address),
        ]);
      })
    )
      .then((results) => {
        const pairs = results.reduce(
          (a, [pair, balance]) => ({
            ...a,
            [pair]: {
              balance: +web3.utils.fromWei(balance, "ether"),
            },
          }),
          {}
        );
        resolve(pairs);
      })
      .catch(reject);
  });
}

function getFarmSLPBalance(pools) {
  const { CONTRACT_MASTERCHEF_ADDRESS = values[1].CONTRACT_MASTERCHEF_ADDRESS } = window.variables;

  const pairTokenContracts = Object.fromEntries(
    pools.map((pool) => [pool.pair, getPairTokenContract(pool.pair)])
  );

  return Promise.all(
    Object.keys(pairTokenContracts).map((pairAddress) => {
      return Promise.all([
        Promise.resolve(pairAddress),
        web3 ? call(pairTokenContracts[pairAddress].methods.balanceOf)(
          CONTRACT_MASTERCHEF_ADDRESS
        ) : Promise.resolve('0'),
      ]);
    })
  )
    .then((results) => {
      const balances = results.reduce(
        (a, [pair, balance]) => ({
          ...a,
          [pair]: {
            balance: fromWei(new BigNumber(balance), 18),
          },
        }),
        {}
      );

      return { balances, pairTokenContracts };
    })
    .catch(console.log);
}

function getAllowance(address, pool, pairContract) {
  const { FACTORY_CONTRACT } = window.variables;

  return Promise.all([
    call(pairContract.methods.allowance)(
      address,
      window.variables.CONTRACT_FACTORY_ADDRESS
    ),
    call(FACTORY_CONTRACT.methods.pendingSecondaryToken)(pool.id, address),
    call(pairContract.methods.balanceOf)(address),
  ]);
}

function toChecksumAddress(address) {
  if (!web3) return address;

  return web3.utils.toChecksumAddress(address);
}

function runHarvest([pid, earning], callback) {
  const { FACTORY_CONTRACT, ACCOUNT } = window.variables;
  console.log(pid, earning)

  if (ACCOUNT) {
    send(FACTORY_CONTRACT.methods.deposit)(pid, 0, { from: ACCOUNT })
      .send()
      .on("transactionHash", (hash) => {
        services.push({ text: `Claim ${earning}`, hash });
      })
      .on("receipt", (receipt) => {
        callback(data, null);
        services.update(receipt);
      })
      .on("error", (error, receipt) => {
        callback(null, error);
        if (receipt) services.update(receipt);
      });
  } else {
    callback(null, {
      error: "Choose account!",
    });
  }
}

function runApproveStaking(pairAddress, name, callback) {
  const {
    ACCOUNT,
    CONTRACT_FACTORY_ADDRESS,
    PAIR_TOKEN_CONTRACTS,
    farm: { LOADDING_APPROVE },
  } = window.variables;

  if (ACCOUNT && !LOADDING_APPROVE) {
    window.variables.farm.LOADDING_APPROVE = 1;

    send(
      PAIR_TOKEN_CONTRACTS[toChecksumAddress(pairAddress)].methods.approve
    )(
      CONTRACT_FACTORY_ADDRESS,
      new BigNumber(2).pow(256).minus(1).toString(10),
      { from: ACCOUNT }
    )
      .send()
      .on("transactionHash", (hash) => {
        window.variables.farm.LOADDING_APPROVE = 0;
        services.push({ text: `Approve ${name}`, hash });
      })
      .on("receipt", (receipt) => {
        window.variables.farm.LOADDING_APPROVE = 0;
        callback(data, null);
        services.update(receipt);
      })
      .on("error", (error, receipt) => {
        window.variables.farm.LOADDING_APPROVE = 0;
        callback(null, error);
        if (receipt) services.update(receipt);
      });
  } else {
    callback(null, {
      error: "Choose account!",
    });
  }
}

function runStake(poolId, amount, name, type = "stake", callback) {
  const { FACTORY_CONTRACT, ACCOUNT } = window.variables;
  console.log(poolId, amount, name, type)

  if (type == "stake" && ACCOUNT) {
    send(FACTORY_CONTRACT.methods.deposit)(
      poolId,
      toWei(new BigNumber(amount), 18).toString(10),
      { from: ACCOUNT }
    )
      .send()
      .on("transactionHash", (hash) => {
        services.push({
          text: `Stake ${Number(amount).toFixed(6)} ${name}`,
          hash,
        });
        $("#stake_asset .js-confirm-btn").attr("disabled", true);
      })
      .on("receipt", (receipt) => {
        callback(data, null);
        services.update(receipt);
        $("#stake_asset .js-confirm-btn").attr("disabled", false);
      })
      .on("error", (error, receipt) => {
        callback(null, error);
        if (receipt) services.update(receipt);
        $("#stake_asset .js-confirm-btn").attr("disabled", false);
      });
  } else if (type == "unstake" && ACCOUNT) {
    send(FACTORY_CONTRACT.methods.withdraw)(
      poolId,
      toWei(new BigNumber(amount), 18).toString(10),
      { from: ACCOUNT }
    )
      .send()
      .on("transactionHash", (hash) => {
        services.push({
          text: `Unstake ${Number(amount).toFixed(6)} SLP (${name})`,
          hash,
        });
        $("#stake_asset .js-confirm-btn").attr("disabled", true);
      })
      .on("receipt", (receipt) => {
        callback(data, null);
        services.update(receipt);
        $("#stake_asset .js-confirm-btn").attr("disabled", false);
      })
      .on("error", (error, receipt) => {
        callback(null, error);
        if (receipt) services.update(receipt);
        $("#stake_asset .js-confirm-btn").attr("disabled", false);
      });
  } else {
    callback(null, {
      error: "Choose account!",
    });
  }
}

function getQuote(amountA, reserveA, reserveB) {
  const { ROUTER_CONTRACT } = window.variables;

  return amountA
    ? call(ROUTER_CONTRACT.methods.quote)(
      toWei(new BigNumber(amountA)).toString(10),
      toWei(new BigNumber(reserveA)).toString(10),
      toWei(new BigNumber(reserveB)).toString(10)
    )
      .then((amountB) => {
        return fromWei(new BigNumber(amountB.toString()));
      })
      .catch((error) => {
        return null;
      })
    : Promise.resolve(null);
}

const formatNumber = (
  value,
  round = 2,
  locale = "en",
  style = null,
  currency = null
) => {
  let newValue = new BigNumber(value).toFixed(round);
  if (style && currency) {
    value = new Intl.NumberFormat(locale, { style, currency }).format(newValue);
  } else if (style) {
    value = new Intl.NumberFormat(locale, { style }).format(newValue);
  } else {
    value = new Intl.NumberFormat(locale).format(newValue);
  }

  return value;
};
