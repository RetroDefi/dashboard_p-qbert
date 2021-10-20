"use strict";
//const contractAddr = "0xcd929f47CE8EB0DC88d30abAC83d002A4c000142";
//const dividendTokenAddr = "0x55d398326f99059fF775485246999027B3197955";
//const bnbAddr = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const contractAddr="0x40038c83e459937a988b669f1159cc78d8fdad68";
const dividendTokenAddr = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
const bnbAddr = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
let totalHolders = 0;
let tokenInfo, dividendTokenInfo;
let secondsUntilAutoClaimAvailable = 0;
let claimCountdownInterval = null;
const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const Fortmatic = window.Fortmatic;
const evmChains = window.evmChains;
let web3Modal;
let provider;
let web3;
let contract;
let selectedAccount;
function init() {
  /*if (location.protocol !== "https:") {
    const alert = document.querySelector("#alert-error-https");
    alert.style.display = "block";
    document.querySelector("#btn-connect").setAttribute("disabled", "disabled");
    return;
  }*/
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      display: { name: "Trust Wallet/MetaMask/Mobile" },
      options: {
        rpc: { 137: "https://polygon-rpc.com" },
        network: "polygon",
      },
    },
  };
  web3Modal = new Web3Modal({
    cacheProvider: false,
    providerOptions,
    disableInjectedProvider: false,
  });
}
async function initContract() {
  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
  const newContract = new web3.eth.Contract(contractAbi, contractAddr, {
    from: selectedAccount,
  });
  return newContract;
}
async function fetchDexguruData() {
  const respDividendToken = await fetch(
    "https://api.dex.guru/v1/tokens/" + dividendTokenAddr + "-polygon"
  );
  dividendTokenInfo = await respDividendToken.json();
  //console.log(dividendTokenInfo)
  //console.log(dividendTokenInfo.priceUSD)
  //console.log("https://api.dex.guru/v1/tokens/" + dividendTokenAddr + "-polygon")
  const responseToken = await fetch(
    "https://api.dex.guru/v1/tokens/" + contractAddr + "-polygon"
  );
  tokenInfo = await responseToken.json();
}
async function fetchTokenData() {
  contract.methods
    .getNumberOfDividendTokenHolders()
    .call()
    .then(function (value) {
      totalHolders = value;
    });
  contract.methods
    .getTotalDividendsDistributed()
    .call()
    .then(function (value) {
      document.querySelector("#dividends-distributed").textContent =
        amountToStr(dividendToNumber(web3, value), 0) +
        " " +
        "MATIC";
    });
}
async function fetchData() {
  let tokenBalance = 0;
  clearCountdownInterval();
  clearAccountInfo();
  await fetchDexguruData();
  await fetchTokenData();
  document.querySelector("#token-price").textContent =
    parseFloat(tokenInfo.priceUSD).toFixed(9) + "$";
  contract.methods
    .balanceOf(selectedAccount)
    .call()
    .then(function (balance) {
      tokenBalance = tokenToNumber(web3, balance);
      document.querySelector("#token-balance").textContent = amountToStr(
        tokenBalance,
        3
      );
      return contract.methods.getAccountDividendsInfo(selectedAccount).call();
    })
    .then(function (values) {
      const iterationsLeft = values[2];
      const withdrawableDividends = values[3];
      const totalDividends = values[4];
      const lastClaimTime = values[5];
      const nextClaimTime = values[6];
      secondsUntilAutoClaimAvailable = values[7];
      const dividendsPayed = dividendToNumber(
        web3,
        web3.utils
          .toBN(totalDividends)
          .sub(web3.utils.toBN(withdrawableDividends))
      );
      document.querySelector("#dividends-payed").textContent =
        amountToStr(dividendsPayed, 2) + " " + "MATIC";
      if (lastClaimTime > 0) {
        const lastPayment = new Date(lastClaimTime * 1000);
        document.querySelector("#last-payment").textContent =
          lastPayment.toLocaleDateString() +
          " " +
          lastPayment.toLocaleTimeString();
      }
      document.querySelector("#withdrawable-dividends").textContent =
        amountToStr(dividendToNumber(web3, withdrawableDividends), 2) +
        " " +
        "MATIC";
      document.querySelector("#auto-payment-bar").style.width =
        ((iterationsLeft * 100) / totalHolders).toString() + "%";
      if (dividendToNumber(web3, withdrawableDividends) == 0) {
        document.querySelector("#btn-claim-text").textContent =
          "Claim my dividends";
        document
          .querySelector("#btn-claim")
          .setAttribute("disabled", "disabled");
      } else {
        claimCountdownInterval = setInterval(
          (function x() {
            secondsUntilAutoClaimAvailable--;
            if (secondsUntilAutoClaimAvailable > 0) {
              document.querySelector("#btn-claim-text").textContent =
                "Claim in " + secondsUntilAutoClaimAvailable + " secs";
              document
                .querySelector("#btn-claim")
                .setAttribute("disabled", "disabled");
            } else {
              document.querySelector("#btn-claim-text").textContent =
                "Claim my dividends";
              document.querySelector("#btn-claim").removeAttribute("disabled");
              clearCountdownInterval();
            }
            return x;
          })(),
          1000
        );
      }
    })
    .then(function () {
      showEstimations(tokenBalance);
      document.querySelector("#prepare").style.display = "none";
      document.querySelector("#connected").style.display = "block";
      document.querySelector("#button-bar").style.display = "block";
    })
    .catch(function (err) {
      document.querySelector("#btn-claim").setAttribute("disabled", "disabled");
    });
}
function showEstimations(tokenBalance) {
  let supplyRatio = (tokenBalance / 10 ** 11) / 4;
  let dailyVolume = document.querySelector("#daily-volume-txt").value;
  let hourlyVolume = dailyVolume / 24;
  let hourlyDividendsGenerated =
    (hourlyVolume * 0.12 * tokenInfo.priceUSD) / dividendTokenInfo.priceUSD;
  let userDividendsPerHour = hourlyDividendsGenerated * supplyRatio;
  let userDividendsPerDay = 24 * userDividendsPerHour;
  let userDividendsPerWeek = 7 * 24 * userDividendsPerHour;
  let userDividendsPerMonth = 30 * 24 * userDividendsPerHour;
  document.querySelector("#estimation-hour").textContent =
    userDividendsPerHour.toFixed(2) + " " + "MATIC"; //MATIC = "dividendTokenInfo.symbol"
  document.querySelector("#estimation-day").textContent =
    userDividendsPerDay.toFixed(2) + " " + "MATIC";
  document.querySelector("#estimation-week").textContent =
    userDividendsPerWeek.toFixed(2) + " " + "MATIC";
  document.querySelector("#estimation-month").textContent =
    userDividendsPerMonth.toFixed(2) + " " + "MATIC";
}
function clearAccountInfo() {
  document.querySelector("#token-balance").textContent = "0";
  document.querySelector("#dividends-payed").textContent = "0";
  document.querySelector("#last-payment").textContent = "-";
  document.querySelector("#withdrawable-dividends").textContent = "-";
  document.querySelector("#auto-payment-bar").style.width = "0%";
  document.querySelector("#btn-claim").setAttribute("disabled", "disabled");
}
function clearCountdownInterval() {
  if (claimCountdownInterval != null) {
    clearInterval(claimCountdownInterval);
    claimCountdownInterval = null;
  }
}
function tokenToNumber(web3, amount) {
  return parseFloat(web3.utils.fromWei(amount, "ether"));
}
function dividendToNumber(web3, amount) {
  return parseFloat(web3.utils.fromWei(amount, "ether"));
}
function amountToStr(amount, decimals) {
  return amount.toLocaleString('en-US', { maximumFractionDigits: decimals });
}
async function refreshAccountData() {
  document.querySelector("#connected").style.display = "none";
  document.querySelector("#prepare").style.display = "block";
  document.querySelector("#btn-connect").setAttribute("disabled", "disabled");
  document
    .querySelector("#btn-disconnect")
    .setAttribute("disabled", "disabled");
  document.querySelector("#btn-refresh").setAttribute("disabled", "disabled");
  document.querySelector("#btn-claim").setAttribute("disabled", "disabled");
  await fetchData(provider);
  document.querySelector("#btn-connect").removeAttribute("disabled");
  document.querySelector("#btn-disconnect").removeAttribute("disabled");
  document.querySelector("#btn-refresh").removeAttribute("disabled");
  document.querySelector("#btn-claim").removeAttribute("disabled");
}
async function onConnect() {
  try {
    provider = await web3Modal.connect();
    web3 = new Web3(provider);
    contract = await initContract();
  } catch (e) {
    console.log("Could not get a wallet connection", e);
    return;
  }
  provider.on("accountsChanged", async (accounts) => {
    contract = await initContract();
    await refreshAccountData();
  });
  provider.on("chainChanged", async (chainId) => {
    contract = await initContract();
    await refreshAccountData();
  });
  await refreshAccountData();
}
async function onRefresh() {
  if (selectedAccount != null) {
    await refreshAccountData();
  }
}
async function onClaim() {
  document.querySelector("#btn-claim").setAttribute("disabled", "disabled");
  contract.methods
    .claim()
    .send()
    .then(function (resp) {
      return refreshAccountData();
    })
    .then(function () {});
}
async function onDisconnect() {
  if (selectedAccount == null) return;
  clearAccountInfo();
  if (provider.close) {
    await provider.close();
    await web3Modal.clearCachedProvider();
    provider = null;
  }
  web3.eth.clearSubscriptions();
  selectedAccount = null;
  web3 = null;
  contract = null;
  clearCountdownInterval();
  document.querySelector("#prepare").style.display = "block";
  document.querySelector("#connected").style.display = "none";
  document.querySelector("#button-bar").style.display = "none";
}
window.addEventListener("load", async () => {
  init();
  document.querySelector("#btn-connect").addEventListener("click", onConnect);
  document
    .querySelector("#btn-disconnect")
    .addEventListener("click", onDisconnect);
  document.querySelector("#btn-refresh").addEventListener("click", onRefresh);
  document.querySelector("#btn-claim").addEventListener("click", onClaim);
});
