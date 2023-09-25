
import { decompressSync } from 'fflate';
import {
    Crs,
    newBarretenbergApiAsync,
    RawBuffer,
} from '@aztec/bb.js/dest/browser/index.js';
import initACVM, { executeCircuit, compressWitness } from '@noir-lang/acvm_js';

function base64ToUint8Array(base64String: string) {
    const binaryString = atob(base64String);
    const length = binaryString.length;
    const uint8Array = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    return uint8Array;
}

async function stringToDigest(inputString: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function initCircuit(bytecode: string): Promise<any> {
    const acirBuffer = base64ToUint8Array(bytecode);
    const acirBufferUncompressed = decompressSync(acirBuffer);

    await initACVM();
    const api = await newBarretenbergApiAsync(1);

    const [exact, total, subgroup] = await api.acirGetCircuitSizes(acirBufferUncompressed);
    console.log(`Exact: ${exact}, Total: ${total}, Subgroup: ${subgroup}`);
    const subgroupSize = Math.pow(2, Math.ceil(Math.log2(total)));
    const crs = await Crs.new(subgroupSize + 1);
    await api.commonInitSlabAllocator(subgroupSize);
    await api.srsInitSrs(
        new RawBuffer(crs.getG1Data()),
        crs.numPoints,
        new RawBuffer(crs.getG2Data()),
    );

    return {
        api,
        acirComposer: await api.acirNewAcirComposer(subgroupSize),
        acirBuffer,
        acirBufferUncompressed
    }
}

function padHexString(hexString: string, lengthInBytes: number, withHexId: boolean): string {
    const targetLength = lengthInBytes * 2; // Each byte is represented by two nibbles in hex
    if (hexString.length >= targetLength) {
        return withHexId ? '0x' + hexString : hexString; // No padding needed
    }

    const paddingLength = targetLength - hexString.length;
    const padding = '0'.repeat(paddingLength);
    return withHexId ? '0x' + padding + hexString : padding + hexString;
}


async function generateWitness(input: string[], acirBuffer: Uint8Array): Promise<Uint8Array> {
    const initialWitness = new Map<number, string>();
    input.forEach((value, index) => {
        initialWitness.set(index + 1, value);
    });

    console.log(initialWitness);
    const witnessMap = await executeCircuit(acirBuffer, initialWitness, () => {
        throw Error('unexpected oracle');
    });
    console.log("Witness executed!");
    console.log(witnessMap);
    const witnessBuff = compressWitness(witnessMap);
    console.log("Witness compressed!");
    return witnessBuff;
}

async function generateProof(witness: Uint8Array, acirComposer: any, api: any, acirBufferUncompressed: Uint8Array) {
    const wit = decompressSync(witness); console.log("Witness decompressed!");
    console.log(wit);
    console.log(acirComposer);
    console.log(acirBufferUncompressed);

    const proof: Uint8Array = await api.acirCreateProof(
        acirComposer,
        acirBufferUncompressed,
        wit,
        false,
    );
    console.log("Got Proof!");

    const hexString: string = Array.from(proof)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    return hexString;
}

async function verifyProof(proof: Uint8Array, acirComposer: any, api: any, acirBufferUncompressed: Uint8Array) {
    await api.acirInitProvingKey(acirComposer, acirBufferUncompressed);
    const verified = await api.acirVerifyProof(acirComposer, proof, false);
    return verified;
}

async function cleanProofFromPublicData(proof: string, numberOfInputs: number) {
    const proofWithoutPublicData = proof.slice(numberOfInputs * 64);
    return proofWithoutPublicData;
}

function hexStringToUint8Array(hexString: string): Uint8Array {
    const byteArray = [];

    for (let i = 0; i < hexString.length; i += 2) {
        byteArray.push(parseInt(hexString.slice(i, i + 2), 16));
    }

    return new Uint8Array(byteArray);
}

export {
    initCircuit,
    generateWitness,
    generateProof,
    stringToDigest,
    padHexString,
    verifyProof,
    cleanProofFromPublicData,
    hexStringToUint8Array
}