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
    baseDate: dataset.base_date
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

// --- Webhookエンドポイント ---
app.post('/postAllCountryNav', async (req, res) => {
  console.log("/postAllCountryNav received request.");
  try {
    const { nav, cmpPrevDay, percentageChange, baseDate } = await fetchNav();
    const diffNav = formatDiff(cmpPrevDay);
    const diffPercentage = formatDiff(percentageChange);
    const referenceDate = formatDate(baseDate); 

    const tweetText = `【eMAXIS Slim 全世界株式（オール・カントリー）】\n基準価額: ${nav}円\n前日比: ${diffNav}円（${diffPercentage}%）\n基準日: ${referenceDate}\n#オルカン #投資信託 #NISA`;

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
