const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aws = require("aws-sdk");
const uniqBy = require("lodash.uniqby");

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
	else if (minutes < (24 * 60)) {
		const h = Math.floor(minutes / 60);
		return `${h} hour${h === 1 ? "" : "s"} ago`;
	}
	const d = Math.floor(minutes / (24 * 60));
	return `${d} day${d === 1 ? "" : "s"} ago`;
};

const scrapeData = (body) => {
	const results = [];
	const $ = cheerio.load(body);
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

	return results.filter(d => d.title.startsWith("[Highlight]") && d.href.includes("streamable.com"));
};

const init = async () => {
	const response = await fetch("https://old.reddit.com/r/nba/new");
	const body = await response.text();

	const timestamp = Date.now();
	const cur = scrapeData(body);
	const prev = await download();

	const curHrefs = cur.map(d => d.href);
	// get rid of prev data that is <5m but not in cur data (it probably got booted)
	const prevPruned = prev.data.filter(d => {
		const fiveMin = 60000 * 5;
		if (timestamp - d.timestamp < fiveMin) return curHrefs.includes(d.href);
		return true;
	});

	const joined = cur.concat(prevPruned);
	joined.sort((a, b) => b.timestamp - a.timestamp);

	const unique = uniqBy(joined, "href");

	const sliced = unique.slice(0, MAX);
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

