function separateItems(items) {
    let maxRadius = 0;
    for (const item of items) {
        maxRadius = Math.max(maxRadius, item.radius);
    }
    const cellSize = Math.max(maxRadius * 2, 0.6);
    const buckets = new Map();
    const cellX = new Array(items.length);
    const cellZ = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        const cx = Math.floor(items[i].node.position.x / cellSize);
        const cz = Math.floor(items[i].node.position.z / cellSize);
        cellX[i] = cx;
        cellZ[i] = cz;
        const key = `${cx},${cz}`;
        const bucket = buckets.get(key) ?? [];
        if (!buckets.has(key)) {
            buckets.set(key, bucket);
        }
        bucket.push(i);
    }

    for (let iteration = 0; iteration < 2; iteration++) {
        for (let i = 0; i < items.length; i++) {
            const itemA = items[i];
            const nodeA = itemA.node;
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
                for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
                    const bucket = buckets.get(`${cellX[i] + offsetX},${cellZ[i] + offsetZ}`);
                    if (!bucket) {
                        continue;
                    }
                    for (const j of bucket) {
                        if (j <= i) {
                            continue;
                        }
                        const itemB = items[j];
                        const dx = itemB.node.position.x - nodeA.position.x;
                        const dz = itemB.node.position.z - nodeA.position.z;
                        const minimumDistance = itemA.radius + itemB.radius;
                        const distanceSquared = dx * dx + dz * dz;
                        if (distanceSquared >= minimumDistance * minimumDistance) {
                            continue;
                        }
                        const distance = Math.sqrt(distanceSquared);
                        if (distance < 1e-6) {
                            const angle = (i * 0.618 + iteration) * Math.PI;
                            itemB.node.setPosition(
                                nodeA.position.x + Math.cos(angle) * minimumDistance,
                                0,
                                nodeA.position.z + Math.sin(angle) * minimumDistance,
                            );
                            continue;
                        }
                        const push = (minimumDistance - distance) * 0.5;
                        const nx = dx / distance;
                        const nz = dz / distance;
                        nodeA.setPosition(nodeA.position.x - nx * push, 0, nodeA.position.z - nz * push);
                        itemB.node.setPosition(itemB.node.position.x + nx * push, 0, itemB.node.position.z + nz * push);
                    }
                }
            }
        }
    }
}

function legacySeparate(nodes) {
    separateItems(nodes.map((node) => ({ node, radius: node.radius })));
}

function legacySeparateDictionary(dictionary, FighterToken) {
    const items = [];
    for (const team in dictionary) {
        for (const identity in dictionary[team]) {
            const node = dictionary[team][identity];
            const fighter = node.getComponent(FighterToken);
            if (fighter && !fighter.isDead) {
                items.push({ node, radius: fighter.radius });
            }
        }
    }
    separateItems(items);
}

module.exports = { legacySeparate, legacySeparateDictionary };
