import axios from "axios";
import sha1 from "sha1";

const BASE_API_URL = "https://clients6.google.com/voice";

class GoogleVoiceApi{

    constructor(cookie) {
        this.cookie = cookie;
        this.key = null;
    }



    async getKey(){
        if(this.key){
            return this.key;
        }
        return this.#request({
            url: 'https://voice.google.com/u/0/messages',
            method: 'get',
        }).then(res => {
            // 正则匹配  ["client_flags.response","https://www.googleapis.com","xxxxxxxxxxxxxxxxx"
            let reg = /client_flags\.response","(.*?)","(.*?)"/;
            let arr = res.data.match(reg);
            if (arr) {
                this.key = arr[2];
            }
            return this.key;
        });
    }

    async sendSms(phone, content) {
        // 随机生成15个数字  261537551327528
        let rand = Math.random().toString().slice(2, 17);
        let res = await this.#requestApi({
            url: "/v1/voiceclient/api2thread/sendsms",
            method: "post",
            data: [null, null, null, null, content, "t.+" + phone, [], null, [rand]]
        })
    }
    async updateReadSms(phone) {
        let res = await this.#requestApi({
            url: "/v1/voiceclient/thread/batchupdateattributes",
            method: "post",
            data: [[[["t.+" + phone, null, null, true, []], [null, null, null, true], 1]]]
        })
    }
    async checkSmsNew(lastId = null) {
        // [0][0][1]  = 0 未读  1已读
        let res = await this.#requestApi({
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

    /**
     * 封装底层带Cookie的请求方法
     * @param options
     * @returns {Promise<axios.AxiosResponse<any>> | *}
     */
    #request(options){
        // SAPISID  cookie获取
        // sha1签名  1675570307 ${SAPISID} https://voice.google.com
        return axios({
            ...options,
            url: options.url,
            headers:{
                'cookie': this.cookie,
                ...options.headers||{}
            }
        });
    }


    /**
     * 封装底层带GoogleApi的请求方法
     * @param options
     * @returns {*}
     */
    #requestApi(options){
        return this.#request({
            ...options,
            url: BASE_API_URL + options.url + '?alt=protojson&key=' + this.key,
            headers:{
                'authorization': this.#authorization(),
                'x-client-version': 505818885,
                'content-type': 'application/json+protobuf',
                'x-origin': 'https://voice.google.com',
                'x-referer': 'https://voice.google.com',
                'x-javascript-user-agent': 'google-api-javascript-client/1.1.0',
            }
        });
    }

    #authorization(){
        let time = Date.now();
        let SAPISID = this.#getCookie("SAPISID");
        let str = `${time} ${SAPISID} https://voice.google.com`
        return `SAPISIDHASH ${time}_` + sha1(str);
    }

    #getCookie = (name) => {
        let reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
        let arr = this.cookie.match(reg);
        if (arr) {
            return arr[2];
        } else {
            return null;
        }
    }

}

export default GoogleVoiceApi;
