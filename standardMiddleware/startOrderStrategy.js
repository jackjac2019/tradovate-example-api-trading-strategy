const { getSocket, getReplaySocket } = require("../websocket/utils")

const startOrderStrategy = (state, action) => {

    const [event, payload] = action

    if(event === 'orderStrategy/startOrderStrategy') {
        const { data, props } = payload
        const { dev_mode } = props
        const { contract, action, brackets, entryVersion } = data
        
        const socket = dev_mode ? getReplaySocket() : getSocket()

        const orderData = {
            entryVersion,
            brackets
        }
        
        const body = {
            accountId: parseInt(process.env.ID, 10),
            accountSpec: process.env.SPEC,
            symbol: contract.name,
            action,
            orderStrategyTypeId: 2,
            params: JSON.stringify(orderData)
        }

        let dispose = socket.request({
            url: 'orderStrategy/startOrderStrategy',
            body,
            callback: (id, r) => {
                if(id === r.id) {
                    console.log('Started order strategy...')
                    writeToLog(r) 
                    dispose()
                }
            }
        })
    }

    return action
}

module.exports = { startOrderStrategy }