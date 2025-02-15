const KuCoin = require('kucoin-node-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure KuCoin SDK
KuCoin.init({
    baseUrl: 'https://api.kucoin.com',
    apiAuth: {
        key: process.env.KUCOIN_API_KEY,       // API key
        secret: process.env.KUCOIN_API_SECRET, // API secret
        passphrase: process.env.KUCOIN_PASSPHRASE // API passphrase
    },
    authVersion: 2
});

const symbol = 'SLN-USDT';
const checkInterval = 10000; // 10 seconds
const priceDifference = 0.0002;
const buyAmount = 2; // Amount of SLN to buy

async function getSLNPrice() {
    try {
        const ticker = await KuCoin.rest.Market.Symbols.getTicker(symbol);
        return parseFloat(ticker.data.price);
    } catch (error) {
        console.error('Error fetching SLN price:', error);
        return null;
    }
}

async function getMinAskPrice() {
    try {
        const orderBook = await KuCoin.rest.Market.OrderBook.getLevel2_20(symbol);
        const asks = orderBook.data.asks;
        if (asks.length > 0) {
            return parseFloat(asks[0][0]); // The first ask price
        }
        return null;
    } catch (error) {
        console.error('Error fetching order book:', error);
        return null;
    }
}

async function placeBuyOrder(price) {
    try {
        console.log(`Buy ${buyAmount} SLN at ${price}`);
        const order = await KuCoin.rest.Trade.Orders.postOrder({
            clientOid: Date.now().toString(),
            side: 'buy',
            symbol: symbol,
            type: 'limit',
            price: price.toString(),
            size: buyAmount.toString()
        });
        if (!order.data) {
            console.log("Something went wrong: ", order);
        } else {
            console.log('Order placed:', order.data);
        }
    } catch (error) {
        console.error('Error placing order:', error);
    }
}

async function monitorAndTrade() {
    const slnPrice = await getSLNPrice();
    const minAskPrice = await getMinAskPrice();

    if (slnPrice && minAskPrice) {
        process.stdout.write(`\rSLN Price: ${slnPrice}, Min Ask Price: ${minAskPrice}`);

        if (minAskPrice >= slnPrice + priceDifference) {
            console.log(`\nMin Ask Price is higher than SLN Price by ${priceDifference}. Placing buy order...`);
            await placeBuyOrder(Math.floor((minAskPrice + 0.01) * 10000) / 10000);
        }
    }
}

// Run the monitorAndTrade function every 30 seconds
setInterval(monitorAndTrade, checkInterval);