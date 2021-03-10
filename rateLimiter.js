const redis = require("redis")
const moment = require("moment")


const redisClient = redis.createClient()

const rateLimiter = (req, res, next) => {
    redisClient.exists(req.headers.user, (err, reply) => {
        if (err) {
            res.status(500).json({ msg: "Redis is not working", err: err });
        }

        const user = req.headers.user;
        
        let currentCall = {
            requestTime: moment().unix(),
        }

        if (reply == 0) { //User does not exist in Redis
            let userCalls = [];
            userCalls.push({ counter: 1 })
            userCalls.push(currentCall)
            redisClient.set(user, JSON.stringify(userCalls))
            next()
        } else if (reply === 1) {
            redisClient.get(req.headers.user, (err, redisResponse) => {

                let userCalls = JSON.parse(redisResponse) //Get data of the specific user
                let counter = userCalls[0].counter;
                let APICalls = userCalls.slice(1);

                const currentTime = moment().unix() //Get timestamp of the current call
                const oneMinuteAgo = moment() //Get the start time of the window
                    .subtract(1, "minute")
                    .unix()
                APICallsInWindow = APICalls.filter(item => { //Get all calls in the time window
                    return item.requestTime > oneMinuteAgo
                })
                counter = APICallsInWindow.length;
                if(counter>0){
                    userCalls = [{ counter: counter }].concat(APICalls);
                }else{
                    userCalls=[counter];
                }
                redisClient.set(user, JSON.stringify(userCalls))

                if (counter >= 5) {
                    const waitTime = 60-currentTime - APICalls[0].requestTime
                    return res.status(429).json({ message: `Please make no more than 5 requests within one minute. Try in ${waitTime} seconds.` })
                } else {
                    counter += 1;
                    userCalls[0].counter = counter
                    userCalls.push(currentCall);
                    redisClient.set(user, JSON.stringify(userCalls))
                   
                    return next()
                }
            })
        }
    })
}

module.exports = rateLimiter;