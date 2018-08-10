const { Base } = require('./base');
const { getSecondsPassed, getRandomInt, createIdentifier } = require('./tools/utils');
const terminal = require('./tools/terminal');

const DEFAULT_OPTIONS = {
    cycleInterval: 300,
    epochInterval: 900,
    beatInterval: 1,
    autoStart: false,
    logIdent: 'HEART',
    onEpoch: (currentEpoch) => Promise.resolve(false),
    onCycle: (currentCycle) => Promise.resolve(false),
    onTick: (currentCycle) => Promise.resolve(0),
};

/**
 * Manages epoch and cycle updates
 * @class Heart
 */
class Heart extends Base {
    constructor (options) {
        super({ ...DEFAULT_OPTIONS, ...options });
        this.id = null;
        this.ticker = null;
        this.lastCycle = null;
        this.lastEpoch = null;
        this.personality = {};
        this.currentCycle = 0;
        this.currentEpoch = 0;
        this.startDate = null;
        this._tick = this._tick.bind(this);
        this.opts.autoStart && this.start()
    }

    start () {
        this.startDate = new Date();
        this.startNewEpoch();
        this.lastCycle = new Date();
        this.log('Cycle/epoch intervals:', this.opts.cycleInterval, this.opts.epochInterval);
        terminal.settings({
            epochInterval: this.opts.epochInterval,
            cycleInterval: this.opts.cycleInterval,
            startDate: this.startDate
        });
        this._tick();
    }

    end () {
        this.ticker && clearTimeout(this.ticker)
    }

    /**
     * Starts new epoch, resetting node identifiers and memorizing last epoch switch datetime.
     */
    startNewEpoch () {
        this.setNewPersonality();
        this.lastEpoch = new Date();
        this.currentEpoch += 1;
    }

    /**
     * Sets this heart's personality: ID, feature, etc.
     */
    setNewPersonality () {
        const id = createIdentifier();
        this.personality = {
            id,
            publicId: id.slice(0, 8),
            feature: id[getRandomInt(0, id.length)]
        };
        this.log('new personality', this.personality.feature, this.personality.id);
    }

    /**
     * Ticker that handles cycle and epoch changes.
     * @private
     */
    _tick () {
        this.opts.onTick(this.currentCycle).then(() => {
            const passedSecondsEpoch = getSecondsPassed(this.lastEpoch);
            const passedSecondsCycle = getSecondsPassed(this.lastCycle);
            const pctEpoch = passedSecondsEpoch / this.opts.epochInterval;
            const pctCycle = passedSecondsCycle / this.opts.cycleInterval;
            terminal.beat({
                epoch: this.currentEpoch,
                cycle: this.currentCycle,
                startDate: this.startDate,
                pctEpoch,
                pctCycle
            });

            if (passedSecondsCycle > this.opts.cycleInterval) {
                this.opts.onCycle(this.currentCycle).then((skipABeat) => {
                    if (!skipABeat) {
                        this.lastCycle = new Date();
                        this.currentCycle += 1;
                        if (passedSecondsEpoch > this.opts.epochInterval) {
                            this.opts.onEpoch(this.currentEpoch).then((skipAge) => {
                                !skipAge && this.startNewEpoch();
                                this._setTicker();
                            });
                            return;
                        }
                    }
                    this._setTicker();
                });
                return;
            }
            this._setTicker();
        });
    }

    /**
     * Sets the ticker for the next beat
     * @private
     */
    _setTicker () {
        this.ticker && clearTimeout(this.ticker);
        this.ticker = setTimeout(this._tick, this.opts.beatInterval * 1000);
    }
}

module.exports = {
    DEFAULT_OPTIONS,
    Heart
};
