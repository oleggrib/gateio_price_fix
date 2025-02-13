const axios = require("axios");
const dotenv = require("dotenv");
// const crypto = require("node:crypto");

dotenv.config();

const IDLE_TIMOUT_IN_MINUTES = 1;
const API_MIN_ORDER_USDT = 3;
const CHECK_INTERVAL_IN_SECONDS = 30;
const DIFFERENCE_THRESHOLD = 0.00015; // if last price is 0.1510 but ask is 0.1511, then make a buy order, approx 0.1%

const apiKey = process.env.GATEIO_API_KEY;
const apiSecret = process.env.GATEIO_API_SECRET;
const symbol = "SLN_USDT"; // Example trading pair

const GateApi = require("gate-api");
const client = new GateApi.ApiClient();

client.setApiKeySecret(apiKey, apiSecret);

// const api = new GateApi.AccountApi(client);
const api = new GateApi.SpotApi(client);

class GateioAPI {
	constructor() {
		this.baseUrl = "https://api.gateio.ws/api/v4";
	}

	// // Generate authentication headers
	// generateHeaders(method, path, queryString = "", body = "") {
	// 	const timestamp = Math.floor(Date.now() / 1000);
	// 	const hashedPayload = crypto
	// 		.createHash("sha512")
	// 		.update(body)
	// 		.digest("hex");
	// 	const signString = `${method}\n${path}\n${queryString}\n${hashedPayload}\n${timestamp}`;
	// 	const signature = crypto
	// 		.createHmac("sha512", this.apiSecret)
	// 		.update(signString)
	// 		.digest("hex");

	// 	return {
	// 		KEY: this.apiKey,
	// 		Timestamp: timestamp.toString(),
	// 		SIGN: signature,
	// 		"Content-Type": "application/json",
	// 		Accept: "application/json",
	// 	};
	// }

	async getLastPrice(symbol) {
		try {
			const response = await axios.get(`${this.baseUrl}/spot/trades`, {
				params: {
					currency_pair: symbol,
					limit: 1,
				},
			});

			const lastTrade = response.data[0];
			return {
				price: lastTrade.price,
				timestamp: parseInt(lastTrade.create_time_ms),
			};
		} catch (error) {
			console.error("Error fetching last price:", error.message);
			throw error;
		}
	}

	async getOrderBook(symbol, limit = 10) {
		try {
			const response = await axios.get(`${this.baseUrl}/spot/order_book`, {
				params: {
					currency_pair: symbol,
					limit: limit,
				},
			});

			return {
				asks: response.data.asks.map((ask) => ({
					price: parseFloat(ask[0]),
					amount: parseFloat(ask[1]),
				})),
				// bids: response.data.bids.map(bid => ({
				//     price: parseFloat(bid[0]),
				//     amount: parseFloat(bid[1])
				// }))
			};
		} catch (error) {
			console.error("Error fetching order book:", error.message);
			throw error;
		}
	}

	// async placeBuyOrder(amount, price) {
	// 	if (!this.apiKey || !this.apiSecret) {
	// 		throw new Error("API credentials required for trading");
	// 	}

	// 	const path = "/spot/orders";
	// 	const body = JSON.stringify({
	// 		currency_pair: symbol,
	// 		type: "limit",
	// 		side: "buy",
	// 		amount: amount.toString(),
	// 		price: price.toString(),
	// 		time_in_force: "ioc",
	// 		account: "spot",
	// 	});

	// 	try {
	// 		const headers = this.generateHeaders("POST", path, "", body);
	// 		// Add debug logging
	// 		console.log("API Key present:", !!this.apiKey);
	// 		console.log("API Secret present:", !!this.apiSecret);
	// 		console.log("Request URL:", `${this.baseUrl}${path}`);
	// 		console.log("Request headers:", {
	// 			...headers,
	// 			KEY: headers.KEY ? `${headers.KEY.substring(0, 5)}...` : undefined,
	// 			SIGN: headers.SIGN ? `${headers.SIGN.substring(0, 5)}...` : undefined,
	// 		});

	// 		const response = await axios.post(`${this.baseUrl}${path}`, body, {
	// 			headers,
	// 		});
	// 		return response.data;
	// 	} catch (error) {
	// 		console.error("Error placing buy order:", {
	// 			status: error.response?.status,
	// 			statusText: error.response?.statusText,
	// 			data: error.response?.data,
	// 			message: error.message,
	// 		});
	// 		throw error;
	// 	}
	// }
}

// Example usage
async function main() {
	const gateio = new GateioAPI();

	// Add credential check
	if (!process.env.GATEIO_API_KEY || !process.env.GATEIO_API_SECRET) {
		console.error("API credentials are missing in .env file");
		process.exit(1);
	}

	setInterval(async () => {
	try {
		// console.log("--------------------------------");
		const lastTrade = await gateio.getLastPrice(symbol);
		// console.log(`Price: ${lastTrade.price}`);
		const timePassed = Math.floor(
			(Date.now() - lastTrade.timestamp) / 1000 / 60
		);
		// console.log(`Last trade time: ${new Date(lastTrade.timestamp).toISOString()}`);


		const orderBook = await gateio.getOrderBook(symbol);

		const priceDifference = orderBook.asks[0].price - lastTrade.price;
        const readyToBuy = timePassed >= IDLE_TIMOUT_IN_MINUTES && priceDifference > DIFFERENCE_THRESHOLD;
        if (!readyToBuy) {
            console.log(`Last trade was ${timePassed} min ago with price ${Math.floor(lastTrade.price * 10000) / 10000} USD, min sell price ${orderBook.asks[0].price} is not higher enough`);
        } else {
            console.warn(`Last trade was ${timePassed} min ago with price ${Math.floor(lastTrade.price * 10000) / 10000} USD, we can buy for ${orderBook.asks[0].price} to increase price`);
			console.log(
				`Minimal sell order use higher than market price! Lets buy SLN for 3 USD (minimal amount for API)`
			);
			try {

				
				const order = {
					currencyPair: symbol, // string | Currency pair
					side: "buy", // string | All bids or asks. Both included if not specified
					account: "spot", // string | Specify account type:  - Classic account: Includes all if not specified - Unified account: Specify `unified` - Unified account (legacy): Can only specify `cross_margin`
                    type: "limit",
                    amount: Math.ceil(API_MIN_ORDER_USDT / orderBook.asks[0].price),
                    price: orderBook.asks[0].price,
                    time_in_force: "ioc",
                };
				const res = await api.createOrder(order)
                console.log("Order added successfully.")
                // console.log("API called successfully. Returned data: ", res.body)

			} catch (orderError) {
				console.error("Failed to place order:", orderError.message);
			}
		}
	} catch (error) {
			console.error("Error in monitoring loop:", error.message);
		}
	}, CHECK_INTERVAL_IN_SECONDS * 1000); 
}

main();
