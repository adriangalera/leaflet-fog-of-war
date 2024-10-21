class LngLat {
    constructor(lng, lat) {
        this.lat = lat
        this.lng = lng
    }
}
class QuadTreeNode {
    constructor(ne, nw, se, sw, maxCapacityperNode) {
        // boundaries
        this.northEastCoord = ne
        this.northWestCoord = nw
        this.southEastCoord = se
        this.southWestCoord = sw

        // children
        this.northEastChild = undefined
        this.northWestChild = undefined
        this.southEastChild = undefined
        this.southWestChild = undefined

        // node values
        this.values = []
        this.maxCapacity = maxCapacityperNode
    }
    static empty(maxCapacityperNode = 100) {
        return new QuadTreeNode(new LngLat(180, 90), new LngLat(-180, 90), new LngLat(180, -90), new LngLat(-180, -90), maxCapacityperNode)
    }
    belongs(lnglat) {
        return this.belongsLatLng(lnglat.lat, lnglat.lng)
    }
    belongsLatLng(lat, lng) {
        const belongsToNode =
            lng <= this.northEastCoord.lng && lng > this.northWestCoord.lng &&
            lat <= this.northWestCoord.lat && lat > this.southWestCoord.lat
        //console.log(`Checking ${lat},${lng} belongs to NE: ${JSON.stringify(this.northEastCoord)}}, NW: ${JSON.stringify(this.northWestCoord)}, SE: ${JSON.stringify(this.southEastCoord)}, SW: ${JSON.stringify(this.southWestCoord)}. With result: ${belongsToNode}`)
        return belongsToNode
    }
    insert(lnglat) {
        if (this.belongs(lnglat)) {
            this.values.push(lnglat)

            if (this.values.length >= this.maxCapacity) {
                //console.log("Splitting into four nodes more ....")
                this.northEastChild = new QuadTreeNode(
                    this.northEastCoord,
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, this.northEastCoord.lat),
                    new LngLat(this.southEastCoord.lng, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    this.maxCapacity
                )
                this.northWestChild = new QuadTreeNode(
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, this.northEastCoord.lat),
                    this.northWestCoord,
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    new LngLat(this.northWestCoord.lng, (this.northWestCoord.lat + this.southWestCoord.lat) / 2),
                    this.maxCapacity
                )
                this.southEastChild = new QuadTreeNode(
                    new LngLat(this.northEastCoord.lng, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    this.southEastCoord,
                    new LngLat((this.southEastCoord.lng + this.southWestCoord.lng) / 2, this.southEastCoord.lat),
                    this.maxCapacity
                )
                this.southWestChild = new QuadTreeNode(
                    new LngLat((this.northEastCoord.lng + this.northWestCoord.lng) / 2, (this.northEastCoord.lat + this.southEastCoord.lat) / 2),
                    new LngLat(this.northWestCoord.lng, (this.northWestCoord.lat + this.southWestCoord.lat) / 2),
                    new LngLat((this.southEastCoord.lng + this.southWestCoord.lng) / 2, this.southWestCoord.lat),
                    this.southWestCoord,
                    this.maxCapacity
                )

                for (let item of this.values) {
                    const insertedNorthEast = this.northEastChild.insert(item)
                    const insertedNorthWest = this.northWestChild.insert(item)
                    const insertedSouthEast = this.southEastChild.insert(item)
                    const insertedSouthWest = this.southWestChild.insert(item)
                    //console.log(`Item ${JSON.stringify(item)} inserted in NE:${insertedNorthEast}, NW:·${insertedNorthWest}, SE:${insertedSouthEast}, SW:${insertedSouthWest}`)
                }

                this.values = []
            }

            return true
        }
        return false
    }
    hasChildNodes() {
        return this.northEastChild != undefined && this.northWestChild != undefined && this.southEastChild != undefined && this.southWestChild != undefined
    }
    locationIsOnTree(lat, lng, tolerance_meters) {
        return this.lngLatIsOnTree(new LngLat(lat, lng), tolerance_meters)
    }
    lngLatIsOnTree(target, tolerance_meters = 10) {
        if (this.hasChildNodes()) {
            return this.northEastChild.lngLatIsOnTree(target, tolerance_meters) ||
                this.southEastChild.lngLatIsOnTree(target, tolerance_meters) ||
                this.northWestChild.lngLatIsOnTree(target, tolerance_meters) ||
                this.southWestChild.lngLatIsOnTree(target, tolerance_meters)
        } else {
            for (let item of this.values) {
                if (this.equalsWithTolerance(target, item, tolerance_meters)) {
                    return true
                }
            }
        }
        return false
    }
    equalsWithTolerance(lnglat1, lnglat2, tolerance) {
        const { lat_drift_allowed, lng_drift_allowed } = this.latLngTolerance(lnglat1.lat, lnglat1.lng, tolerance)
        const lat_diff = Math.abs(lnglat1.lat - lnglat2.lat)
        const lng_diff = Math.abs(lnglat1.lng - lnglat2.lng)
        return lat_diff <= lat_drift_allowed && lng_diff <= lng_drift_allowed
    }
    latLngTolerance(lat, lng, meters) {
        //https://stackoverflow.com/questions/7477003/calculating-new-longitude-latitude-from-old-n-meters
        // number of km per degree = ~111km (111.32 in google maps, but range varies
        // between 110.567km at the equator and 111.699km at the poles)
        //
        // 111.32km = 111320.0m (".0" is used to make sure the result of division is
        // double even if the "meters" variable can't be explicitly declared as double)
        const coef = meters / 111320.0;
        const lat_drift_allowed = coef;
        // pi / 180 ~= 0.01745
        const lng_drift_allowed = coef / Math.cos(lat * 0.01745);
        return { lat_drift_allowed, lng_drift_allowed }
    }

}
module.exports = {
    QuadTreeNode: QuadTreeNode,
    LngLat: LngLat
}