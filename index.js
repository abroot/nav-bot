import express from 'express';
import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';

const app = express();
const port = process.env.PORT || 3000;

// X API認証情報（環境変数）
const client = new TwitterApi({
  appKey: process.env.APP_KEY,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- オルカン基準価額botの関数 ---
async function fetchNav() {
  const url = "https://developer.am.mufg.jp/fund_information_latest/fund_cd/253425";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const data = await res.json();
  if (!data.datasets || !data.datasets[0]) throw new Error("No datasets returned from MUFG API");
  const dataset = data.datasets[0];
  return {
    nav: dataset.nav,
    cmpPrevDay: dataset.cmp_prev_day,
    percentageChange: dataset.percentage_change,
    baseDate: dataset.base_date,
    navMaxFull: dataset.nav_max_full
  };
}

async function postToX(text) {
  try {
    // OAuth 1.0a User Context で投稿
    const rwClient = client.readWrite;
    const response = await rwClient.v2.tweet(text);
    console.log("投稿成功:", response);
  } catch (error) {
    console.error("投稿失敗:", error);
  }
}

function formatDiff(diff) {
  return diff > 0 ? `+${diff}` : `${diff}`; // 0 or negative の場合はそのまま
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd; // 想定外フォーマットならそのまま返す
  const year = yyyymmdd.slice(0, 4);
  const month = parseInt(yyyymmdd.slice(4, 6), 10);
  const day = parseInt(yyyymmdd.slice(6, 8), 10);
  return `${year}年${month}月${day}日`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildTweetText({ nav, cmpPrevDay, percentageChange, baseDate, navMaxFull }) {
  const diffNavValue = toNumber(cmpPrevDay);
  const diffNav = formatDiff(cmpPrevDay);
  const diffPercentage = formatDiff(percentageChange);
  const referenceDate = formatDate(baseDate);
  const currentNav = toNumber(nav);
  const recordHigh = toNumber(navMaxFull);
  const diffEmoji = diffNavValue !== null && diffNavValue < 0 ? "📉" : "📈";
  const isRecordHigh =
    currentNav !== null &&
    recordHigh !== null &&
    currentNav > recordHigh;

  const lines = [];

  if (isRecordHigh) {
    lines.push("🎉 過去最高値更新！");
    lines.push("");
  }

  lines.push("【eMAXIS Slim 全世界株式（オール・カントリー）】");
  lines.push("");
  lines.push(`💰 基準価額: ${nav}円`);
  lines.push(`${diffEmoji} 前日比: ${diffNav}円（${diffPercentage}%）`);
  lines.push(`📅 基準日: ${referenceDate}`);
  lines.push("");
  lines.push("#オルカン #投資信託 #NISA");

  return lines.join("\n");
}

// --- Webhookエンドポイント ---
app.post('/postAllCountryNav', async (req, res) => {
  console.log("/postAllCountryNav received request.");
  try {
    const navData = await fetchNav();
    const tweetText = buildTweetText(navData);

    await postToX(tweetText);
    console.log(tweetText);

    res.status(200).send("/postAllCountryNav executed.\n");
  } catch (error) {
    console.error(error);
    res.status(500).send("/postAllCountryNav failed.\n");
  }
});

// --- /wakeup エンドポイント ---
app.get('/wakeup', (req, res) => {
  console.log(`[WAKEUP] Render instance woke up at ${new Date().toISOString()}`);
  res.status(200).send("I'm awake!\n");
});

// サーバー起動
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
