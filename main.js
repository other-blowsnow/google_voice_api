import axios from "axios";
import sha1 from "sha1";
import fs from "fs";
import GoogleVoiceApi from "./GoogleVoiceApi.js";

const cookie = process.env.COOKIE;

const Api = new GoogleVoiceApi(cookie)

const getContent = async () => {
    let res = await axios.get("https://v1.hitokoto.cn/");
    return res.data.hitokoto;
}

async function handle(){
    let list = await Api.checkSmsNew();

    console.log("find new" , list.length);

    for (const item of list) {
        if (!item.ua) continue;
        console.log("回复短信", item.phone);
        try {
            await Api.updateReadSms(item.phone);
            await Api.sendSms(item.phone, await getContent());
        }catch (e){
            console.log("发送失败", item.phone, e.message);
        }
    }
}

async function main() {

    let tempKey = await Api.getKey();

    console.log("key", tempKey);

    await handle();
}

main();
