const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aws = require("aws-sdk");

const MAX = 6;
const s3 = new aws.S3();
const Bucket = "pudding.cool";
const Key = `misc/nba-highlight-hub/data.json`;

const download = () => {
	return new Promise((resolve, reject) => {
		const params = { Bucket, Key };
		s3.getObject(params, (err, response) => {
			if (err) reject(err);
			else if (response) {
				const buffer = response.Body;
				const str = buffer.toString("utf8");
				const data = JSON.parse(str);
				resolve(data);
			} else reject("no response");
		});
	});
};

const upload = (data) => {
	return new Promise((resolve, reject) => {
		const Body = JSON.stringify(data);
		const params = { Bucket, Key, Body };
		s3.putObject(params, (err, response) => {
			if (err) reject(err);
			else if (response) resolve(response);
		});
	});
}

const makeSrc = str => {
	return str.replace(".com/", ".com/e/");
};

const getAgo = (t) => {
	const diff = Date.now() - t;
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	else if (minutes < (24 * 60)) return `${minutes / 60} hour${minutes / 60 === 1 ? "" : "s"} ago`;
	return `${minutes / (24 * 60)} day${minutes / (24 * 60) === 1 ? "" : "s"} ago`;
};

const init = async () => {
	const response = await fetch("https://old.reddit.com/r/nba/new");
	const body = await response.text();
	const $ = cheerio.load(body);
	const results = [];
	$("#siteTable .thing").each((i, el) => {
		const a = $(el).find("a.title");
		const title = $(a).text();
		const href = $(a).attr("href");

		const time = $(el).find(".tagline time");
		const datetime = $(time).attr("datetime");
		const timestamp = (new Date(datetime)).getTime();
		const comments = $(el).find("a.comments").attr("href");

		results.push(({ title, href, timestamp, comments }));
	});

	const newData = results
		.filter(d => d.title.startsWith("[Highlight]") && d.href.includes("streamable.com"));

	const timestamp = Date.now();

	const old = await download();
	const joined = newData.concat(old.data);
	joined.sort((a, b) => b.timestamp - a.timestamp);
	const sliced = joined.slice(0, MAX);
	const data = sliced.map(d => ({
		...d,
		ago: getAgo(d.timestamp)
	}));

	await upload({ timestamp, data });

	return;
};


exports.handler = async event => {
	try {
		await init();
		return null;
	} catch (err) {
		console.log(err);
	}
};

