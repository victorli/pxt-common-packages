namespace jacdac {
    // This enumeration specifies that supported configurations that drivers should utilise.
    // Many combinations of flags are supported, but only the ones listed here have been fully implemented.
    export enum DriverType {
        VirtualDriver = DAL.JD_DEVICE_FLAGS_REMOTE, // the driver is seeking the use of another device's resource
        PairedDriver = DAL.JD_DEVICE_FLAGS_BROADCAST | DAL.JD_DEVICE_FLAGS_PAIR,
        HostDriver = DAL.JD_DEVICE_FLAGS_LOCAL, // the driver is hosting a resource for others to use.
        PairableHostDriver = DAL.JD_DEVICE_FLAGS_PAIRABLE | DAL.JD_DEVICE_FLAGS_LOCAL, // the driver is allowed to pair with another driver of the same class
        BroadcastDriver = DAL.JD_DEVICE_FLAGS_LOCAL | DAL.JD_DEVICE_FLAGS_BROADCAST, // the driver is enumerated with its own address, and receives all packets of the same class (including control packets)
        SnifferDriver = DAL.JD_DEVICE_FLAGS_REMOTE | DAL.JD_DEVICE_FLAGS_BROADCAST, // the driver is not enumerated, and receives all packets of the same class (including control packets)
    };

    export class Driver {
        public name: string;
        protected _proxy: JacDacDriverStatus;
        public driverType: jacdac.DriverType;
        public deviceClass: number;
        protected supressLog: boolean;
        private _controlData: Buffer;

        constructor(name: string, driverType: jacdac.DriverType, deviceClass: number, controlDataLength = 0) {
            this.name = name;
            this.driverType = driverType;
            this.deviceClass = deviceClass || control.programHash();
            this._controlData = control.createBuffer(Math.max(0, controlDataLength));
        }

        get id(): number {
            return this._proxy.id;
        }

        hasProxy(): boolean {
            return !!this._proxy;
        }

        setProxy(value: JacDacDriverStatus) {
            this._proxy = value;
            if (this._controlData.length)
                control.onEvent(this._proxy.id, JD_DRIVER_EVT_FILL_CONTROL_PACKET, () => this.updateControlPacket());
        }

        /**
         * Update the controlData buffer
         */
        protected updateControlPacket() {
        }

        get controlData(): Buffer {
            return this._controlData;
        }

        get isConnected(): boolean {
            return this._proxy && this._proxy.isConnected;
        }

        protected get device(): jacdac.JDDevice {
            return new jacdac.JDDevice(this._proxy.device);
        }

        public log(text: string) {
            if (!this.supressLog)
                console.add(jacdac.consolePriority, `jd>${this.name}>${text}`);
        }

        /**
         * Registers code to run a on a particular event
         * @param event 
         * @param handler 
         */
        public onDriverEvent(event: JacDacDriverEvent, handler: () => void) {
            control.onEvent(this._proxy.id, event, handler);
        }

        /**
         * Called by the logic driver when a data packet is addressed to this driver
         * Return false when the packet wasn't handled here.
         */
        public handlePacket(pkt: Buffer): boolean {
            return false
        }

        /**
         * Called by the logic driver when a control packet is received
         * @param pkt 
         */
        public handleControlPacket(pkt: Buffer): boolean {
            return false;
        }

        protected sendPacket(pkt: Buffer) {
            jacdac.sendPacket(pkt, this.device.address);
        }
    }

    /**
     * base class for pairable drivers
    */
    export class PairableDriver extends Driver {
        constructor(name: string, isHost: boolean, deviceClass: number) {
            super(name, isHost ? DriverType.PairableHostDriver : DriverType.PairedDriver, deviceClass);
        }

        protected canSendPacket(): boolean {
            return this.isConnected && this.device.isPaired();
        }

        public handlePacket(pkt: Buffer): boolean {
            const packet = new JDPacket(pkt);
            this.log(`rec ${packet.data.length}b from ${packet.address}`)
            const dev = this.device;
            if (!this.isConnected || !dev.isPaired()) {
                this.log("not conn")
                return true;
            }
            if (!this._proxy.isPairedInstanceAddress(packet.address)) {
                this.log('invalid paired address')
                return true;
            }
            if (dev.isPairedDriver())
                return this.handleHostPacket(packet);
            else
                return this.handleVirtualPacket(packet);
        }

        /**
         * Processes the packet received by the host
         * @param packet 
         */
        protected handleHostPacket(packet: JDPacket): boolean {
            return true;
        }

        /**
         * Processes the packet received by the virtual driver
         * @param packet 
         */
        protected handleVirtualPacket(packet: JDPacket): boolean {
            return true;
        }
    }
}