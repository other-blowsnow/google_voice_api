import axios from "axios";
import sha1 from "sha1";
import fs from "fs";

const BASE_API_URL = "https://clients6.google.com/voice";
const cookie = process.env.COOKIE.trim();
const getCookie = (name) => {
    let reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
    let arr = cookie.match(reg);
    if (arr) {
        return arr[2];
    } else {
        return null;
    }
}

let key = "";

function getkey(){
    if(key){
        return key;
    }
    return request({
        url: 'https://voice.google.com/u/0/messages',
        method: 'get',
    }).then(res => {
        // 正则匹配  ["client_flags.response","https://www.googleapis.com","xxxxxxxxxxxxxxxxx"
        let reg = /client_flags\.response","(.*?)","(.*?)"/;
        let arr = res.data.match(reg);
        if (arr) {
            key = arr[2];
        }
        return key;
    });
}
function authorization(){
    let time = Date.now();
    let SAPISID = getCookie("SAPISID");
    let str = `${time} ${SAPISID} https://voice.google.com`
    return `SAPISIDHASH ${time}_` + sha1(str);
}
function request(options){
    // SAPISID  cookie获取
    // sha1签名  1675570307 ${SAPISID} https://voice.google.com
    return axios({
        ...options,
        url: options.url,
        headers:{
            'cookie': cookie,
            ...options.headers||{}
        }
    });
}
function requestApi(options){
    return request({
        ...options,
        url: BASE_API_URL + options.url + '?alt=protojson&key=' + key,
        headers:{
            'authorization': authorization(),
            'x-client-version': 505818885,
            'content-type': 'application/json+protobuf',
            'x-origin': 'https://voice.google.com',
            'x-referer': 'https://voice.google.com',
            'x-javascript-user-agent': 'google-api-javascript-client/1.1.0',
        }
    });
}
async function sendSms(phone, content) {
    // 随机生成15个数字  261537551327528
    let rand = Math.random().toString().slice(2, 17);
    let res = await requestApi({
        url: "/v1/voiceclient/api2thread/sendsms",
        method: "post",
        data: [null, null, null, null, content, "t.+" + phone, [], null, [rand]]
    })
}
async function updateReadSms(phone) {
    let res = await requestApi({
        url: "/v1/voiceclient/thread/batchupdateattributes",
        method: "post",
        data: [[[["t.+" + phone, null, null, true, []], [null, null, null, true], 1]]]
    })
}
async function checkSmsNew(lastId = null) {
    // [0][0][1]  = 0 未读  1已读
    let res = await requestApi({
        url: "/v1/voiceclient/api2thread/list",
        method: "post",
        data: [1, 10, 15, null, lastId, [null, true, true]]
    })

    let list = res.data[0];
    let newList = [];
    for (const item of list) {
        if (item[0].indexOf("t.") === -1) {
            continue;
        }
        if (item[1] != 0) continue;

        let phone = item[0].slice(2);
        let ua = true;
        // 以+开头的号码 删除  +
        if (phone.indexOf("+") === 0) {
            ua = phone.startsWith("+1");
            phone = phone.slice(1);
        }
        let params = {
            status: item[1],
            phone: phone,
            ua: ua,
            messages: item[2].map(message => {
                return {
                    id: message[0],
                    content: message[9],
                    me: message[12] == 6
                }
            }),
        }
        newList.push(params);
    }
    return newList;
}

const getContent = async () => {
    let res = await axios.get("https://v1.hitokoto.cn/");
    return res.data.hitokoto;
}

async function handle(){
    let list = await checkSmsNew();

    console.log("find new" , list.length);

    for (const item of list) {
        if (!item.ua) continue;
        console.log("回复短信", item.phone);
        try {
            await updateReadSms(item.phone);
            await sendSms(item.phone, await getContent());
        }catch (e){
            console.log("发送失败", item.phone);
        }
    }

    setTimeout(handle, 5000);
}

async function main() {

    let tempKey = await getkey();

    console.log("key", tempKey);

    setTimeout(handle, 5000);
}

main();
