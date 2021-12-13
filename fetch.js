import fs from "fs";
import fetch from "node-fetch";
import cheerio from "cheerio";

const MAX = 6;
const template = fs.readFileSync("./template.html", "utf8");

(async () => {
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

		results.push(({ title, href, datetime, ago }));
	});

	const streamable = results
		.filter(d => d.title.startsWith("[Highlight]") && d.href.includes("streamable.com"))
		.slice(0, MAX);

	const makeSrc = str => {
		return str.replace(".com/", ".com/e/");
	};

	const highlights = streamable.map(({ title, href, datetime, ago }) =>
		`<div class="highlight">
			<h2 class="title">${title}</h2>
			<p data-datetime="${datetime}" class="ago">${ago}</p>
			<div style="width:100%;height:0px;position:relative;padding-bottom:56.25%;">
  		<iframe src="${makeSrc(href)}?autoplay=1&nocontrols=0&muted=1" frameborder="0" width="100%" height="100%" allowfullscreen allow="autoplay" style="width:100%;height:100%;position:absolute;left:0px;top:0px;overflow:hidden;"></iframe>
			</div>
  	</div>`
	).join("");

	const html = template.replace("<!-- highlights -->", highlights);
	fs.writeFileSync("./index.html", html);

	// fs.writeFileSync("./data.txt", html);
})();