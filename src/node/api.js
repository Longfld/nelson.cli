const http = require('http');
const request = require('request');
const HttpDispatcher = require('httpdispatcher');
const crypto = require('crypto');
const version = require('../../package.json').version;
const salt = require('./tools/utils').createIdentifier();

/**
 * Creates an API interface for the Node. Accepts incoming connections.
 * Also, is able to make webhook calls.
 * @param {object} node
 * @param {string[]} webhooks
 * @param {number} interval
 */
function createAPI (node, webhooks, interval=30) {
    const dispatcher = new HttpDispatcher();
    dispatcher.onGet('/', function(req, res) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(getNodeStats(node, !server.isLocalRequest(req)), null, 4));
    });

    dispatcher.onGet('/peers', function(req, res) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(
            node.list.all().map((peer) => getPeerStats(peer, !server.isLocalRequest(req))),
            null, 4
        ));
    });

    dispatcher.onGet('/peer-stats', function(req, res) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(getSummary(node), null, 4));
    });

    const server = http.createServer((request, response) => {
        // Set CORS headers
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Request-Method', '*');
        response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        response.setHeader('Access-Control-Allow-Headers', '*');
        if ( request.method === 'OPTIONS' ) {
            response.writeHead(200);
            response.end();
            return;
        }

        try {
            dispatcher.dispatch(request, response);
        } catch(err) {
            console.log(err);
        }
    });

    server.isLocalRequest = function(req) {
        const clientAddress = req.connection.remoteAddress || req.socket.remoteAddress;
        const serverAddress = server.address().address;

        return clientAddress === serverAddress;
    };

    server.listen(node.opts.apiPort, node.opts.apiHostname);

    if (webhooks && webhooks.length) {
        setInterval(() => {
            webhooks.forEach((uri) => request({ uri, method: 'POST', json: getNodeStats(node) }, (err) => {
                if (err) {
                    node.log(`Webhook returned error: ${uri}`.yellow);
                }
            }));
        }, interval * 1000);
    }
}

function getMD5Hash(string) {
    return crypto.createHash('md5').update(`${salt}::${string ? string.toString() : 'null'}`).digest('hex');
}

function getNodeStats (node, anonymous=false) {
    const {
        cycleInterval,
        epochInterval,
        beatInterval,
        dataPath,
        port,
        apiPort,
        IRIPort,
        TCPPort,
        UDPPort,
        isMaster,
        IRIProtocol,
        temporary
    } = node.opts;
    const {
        lastCycle,
        lastEpoch,
        personality,
        currentCycle,
        currentEpoch,
        startDate
    } = node.heart;
    const totalPeers = node.list.all().length;
    const isIRIHealthy = node.iri && node.iri.isHealthy;
    const iriStats = node.iri && node.iri.iriStats;
    const connectedPeers = Array.from(node.sockets.keys())
        .filter((p) => node.sockets.get(p).readyState === 1)
        .map((peer) => getPeerStats(peer, anonymous));

    return {
        name: node.opts.name,
        version,
        ready: node._ready,
        isIRIHealthy,
        iriStats,
        peerStats: getSummary(node),
        totalPeers,
        connectedPeers,
        config: {
            cycleInterval,
            epochInterval,
            beatInterval,
            dataPath,
            port,
            apiPort,
            IRIPort,
            TCPPort,
            UDPPort,
            IRIProtocol,
            isMaster,
            temporary
        },
        heart: {
            lastCycle,
            lastEpoch,
            personality,
            currentCycle,
            currentEpoch,
            startDate
        }
    }
}

function getPeerStats (peer, isAnonymous=false) {
    const {
        name,
        hostname,
        ip,
        port,
        TCPPort,
        UDPPort,
        protocol,
        seen,
        connected,
        tried,
        weight,
        dateTried,
        dateLastConnected,
        dateCreated,
        IRIProtocol,
        isTrusted,
        lastConnections
    } = peer.data;
    return {
        name,
        hostname: isAnonymous ? getMD5Hash(hostname.toString()) : hostname,
        ip: isAnonymous ? getMD5Hash(ip.toString()) : ip,
        port,
        TCPPort,
        UDPPort,
        protocol,
        IRIProtocol,
        seen,
        connected,
        tried,
        weight,
        dateTried,
        dateLastConnected,
        dateCreated,
        isTrusted,
        lastConnections,
        isAnonymous
    }
}

function getSummary (node) {
    const now = new Date();
    const hour = 3600000;
    const hourAgo = new Date(now - hour);
    const fourAgo = new Date(now - (hour * 4));
    const twelveAgo = new Date(now - (hour * 12));
    const dayAgo = new Date(now - (hour * 24));
    const weekAgo = new Date(now - (hour * 24 * 7));
    return {
        newNodes: {
            hourAgo: node.list.all().filter(p => p.data.dateCreated >= hourAgo).length,
            fourAgo: node.list.all().filter(p => p.data.dateCreated >= fourAgo).length,
            twelveAgo: node.list.all().filter(p => p.data.dateCreated >= twelveAgo).length,
            dayAgo: node.list.all().filter(p => p.data.dateCreated >= dayAgo).length,
            weekAgo: node.list.all().filter(p => p.data.dateCreated >= weekAgo).length,
        },
        activeNodes: {
            hourAgo: node.list.all().filter(p => p.data.dateLastConnected >= hourAgo).length,
            fourAgo: node.list.all().filter(p => p.data.dateLastConnected >= fourAgo).length,
            twelveAgo: node.list.all().filter(p => p.data.dateLastConnected >= twelveAgo).length,
            dayAgo: node.list.all().filter(p => p.data.dateLastConnected >= dayAgo).length,
            weekAgo: node.list.all().filter(p => p.data.dateLastConnected >= weekAgo).length,
        }
    }
}

module.exports = {
    createAPI,
    getNodeStats
};
