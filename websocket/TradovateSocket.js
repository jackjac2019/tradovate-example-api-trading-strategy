const WebSocket = require('ws')
const { writeToLog } = require('../utils/helpers')
// const logger = require('../utils/logger')

function Counter() {
    this.current = 0
    this.increment = () => {
        this.current += 1
        return this.current
    }
}

/**
 * Constructor for the Tradovate WebSocket
 */
function TradovateSocket() {
    this.ws = null
    this.counter = new Counter()    
}

TradovateSocket.prototype.getSocket = function() {
    return this.ws
}

/**
 * Sets up a request/response pairing that will call `callback` when the response is received. 
 * This function will return a cancellable subscription in the form of a function with zero parameters
 * that removes the event listener.
 */
TradovateSocket.prototype.request = function({url, query, body, callback, disposer}) {
    const id = this.counter.increment()

    const resSubscription = msg => {

        if(msg.data.slice(0, 1) !== 'a') { return }

        let data
        try {
            data = JSON.parse(msg.data.slice(1))
        } catch(err) {
            data = []
            console.log('failed to process message: ' + err)
        }

        if(data.length > 0) {
            data.forEach(item => {
                // console.log(item)
                callback(id, item)
            })
        }
    } 

    this.ws.addEventListener('message', resSubscription)
    this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)

    return () => {
        if(disposer && typeof disposer === 'function'){
            disposer()
        }
        this.ws.removeListener('message', resSubscription)
    }
}

TradovateSocket.prototype.synchronize = function(callback) {
    if(!this.ws || this.ws.readyState == 3 || this.ws.readyState == 2) {
        console.warn('no websocket connection available, please connect the websocket and try again.')
        return
    }
    return this.request({
        url: 'user/syncrequest',
        body: { accounts: [parseInt(process.env.ID, 10)] },
        callback: (id, data) => { 
            if(data.i === id
            || (data.e && data.e === 'props')
            || (data.e && data.e === 'clock')) {
                callback(data.d)
            }
        }
    })
}

// /**
//  * Set a function to be called when the socket synchronizes.
//  */
// TradovateSocket.prototype.onSync = function(callback) {
//     this.ws.addEventListener('message', async msg => {
//         const { data } = msg
//         const kind = data.slice(0,1)
//         switch(kind) {
//             case 'a':
//                 const  parsedData = JSON.parse(msg.data.slice(1))
//                 // console.log(parsedData)
//                 let schemaOk = {}
//                 const schemafields = ['users']
//                 parsedData.forEach(data => {
//                     schemafields.forEach(k => {
//                         if(schemaOk && !schemaOk.value) {
//                             return
//                         }
//                         if(Object.keys(data.d).includes(k) && Array.isArray(data.d[k])) {
//                             schemaOk = { value: true }
//                         } 
//                         // else {
//                         //     schemaOk = { value: false }
//                         // }
//                     })
                    
//                     if(schemaOk.value) {
//                         callback(data.d)
//                     }
//                 })
//                 break
//             default:
//                 break
//         }
//     })
// }

TradovateSocket.prototype.connect = async function(url) {

    this.ws = new WebSocket(url)
    this.ws.setMaxListeners(24)
    this.counter = new Counter()
    
    let interval

    return new Promise((res, rej) => {
        this.ws.addEventListener('message', async msg => {
            const { type, data } = msg

            const kind = data.slice(0,1)
            if(type !== 'message') {
                console.log('non-message type received')
                return
            }

            //message discriminator
            switch(kind) {
                case 'o':      
                    // console.log('Making WS auth request...')
                    const token = this.constructor.name === 'TradovateSocket' ? process.env.ACCESS_TOKEN : process.env.MD_ACCESS_TOKEN
                    this.ws.send(`authorize\n0\n\n${token}`)          
                    interval = setInterval(() => {
                        if(this.ws.readyState == 0 || this.ws.readyState == 3 || this.ws.readyState == 2) {
                            clearInterval(interval)
                            return
                        }
                        this.ws.send('[]')
                    }, 2500)
                    break
                case 'h':
                    break
                case 'a':
                    const parsedData = JSON.parse(msg.data.slice(1))

                    const [first] = parsedData
                    if(first.i === 0 && first.s === 200) {
                        res()
                    } else rej()
                    break
                case 'c':
                    clearInterval(interval)
                    break
                default:
                    console.error('Unexpected response token received:')
                    console.error(msg)
                    break
            }
        })
    })    
}

TradovateSocket.prototype.disconnect = function() {
    console.log('closing websocket connection')
    this.ws.removeAllListeners('message')
    this.ws.close(1000, `Client initiated disconnect.`)
    this.ws = null
}

TradovateSocket.prototype.isConnected = function() {
    return this.ws && this.ws.readyState != 2 && this.ws.readyState != 3
}

module.exports = { TradovateSocket }