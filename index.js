const fs = require("fs");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aws = require("aws-sdk");

const s3 = new aws.S3();
const template = fs.readFileSync("./template.html", "utf8");

const upload = (data) => {
	return new Promise((resolve, reject) => {
		const Bucket = "pudding.cool";
		const Key = `misc/nba-highlight-hub/data.json`;
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
		const ago = $(time).text();

		const comments = $(el).find("a.comments").attr("href");

		results.push(({ title, href, datetime, ago, comments }));
	});

	const data = results
		.filter(d => d.title.startsWith("[Highlight]") && d.href.includes("streamable.com"));

	const timestamp = Date.now();

	await upload({ timestamp, data });

	return;
	// const highlights = streamable.map(({ title, href, datetime, ago }) =>
	// 	`<div class="highlight">
	// 		<h2 class="title">${title}</h2>
	// 		<p data-datetime="${datetime}" class="ago">${ago}</p>
	// 		<div style="width:100%;height:0px;position:relative;padding-bottom:56.25%;">
	// 		<iframe src="${makeSrc(href)}?autoplay=1&nocontrols=0&muted=1" frameborder="0" width="100%" height="100%" allowfullscreen allow="autoplay" style="width:100%;height:100%;position:absolute;left:0px;top:0px;overflow:hidden;"></iframe>
	// 		</div>
	// 	</div>`
	// ).join("");

	// const html = template.replace("tk-version", version).replace("<!-- highlights -->", highlights);
	// fs.writeFileSync("./index.html", html);

	// fs.writeFileSync("./data.txt", html);
};


exports.handler = async event => {
	try {
		await init();
		return null;
	} catch (err) {
		console.log(err);
	}
};

