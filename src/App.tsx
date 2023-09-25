
import { Box, Button, Chip, CircularProgress, Container, Divider, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import './App.css';
import circuit from './example.json';
import {
  initCircuit,
  generateWitness,
  generateProof,
  stringToDigest,
  padHexString,
  cleanProofFromPublicData,
  hexStringToUint8Array,
  verifyProof
} from './zkcircuits';

enum ProofStatus {
  NOT_STARTED,
  SUCCESS,
  FAILED,
}

function App() {

  const [proofValue, setProofValue] = useState<string>("");
  const [removedValue, setRemovedValue] = useState<string>("");
  const [loadingProof, setLoadingProof] = useState<boolean>(false);
  const [proofStatus, setProofStatus] = useState<ProofStatus>(ProofStatus.NOT_STARTED);
  const [xHash, setXHash] = useState<string>("");


  const buildProof = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const x = data.get('x');
    const y = data.get('y');
    console.log("building proof for ", x, y);
    setLoadingProof(true);
    try {
      initCircuit(circuit.bytecode).then(async ({ api, acirComposer, acirBuffer, acirBufferUncompressed }) => {
        const xHash = await stringToDigest(x as string);
        const yHash = await stringToDigest(y as string);
        setXHash(xHash);

        const input: any = [];
        input.push(padHexString(xHash, 32, true));
        input.push(padHexString(yHash, 32, true));

        console.log("input", input);

        const witness = await generateWitness(input, acirBuffer);
        console.log("witness", witness);

        const proof = await generateProof(witness, acirComposer, api, acirBufferUncompressed);
        const cleanedProof = await cleanProofFromPublicData(proof, 1);

        setProofValue(cleanedProof);

        setLoadingProof(false);
        setProofStatus(ProofStatus.NOT_STARTED);
      });
    } catch (error) {
      console.log(error);
      setLoadingProof(false);
    }
  }

  const triggerVerifyProof = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const yv = data.get('yv');
    console.log("verifying proof for ", yv);
    setLoadingProof(true);
    try {
      initCircuit(circuit.bytecode).then(async ({ api, acirComposer, acirBuffer, acirBufferUncompressed }) => {
        const input: any = [];
        input.push(yv);
        input.push(proofValue);
        const proofValidation = input.join("");
        console.log('Proof validation:', proofValidation);

        const verificationResult = await verifyProof(hexStringToUint8Array(proofValidation), acirComposer, api, acirBufferUncompressed);
        console.log('Proof validation result:', verificationResult);
        if (verificationResult) {
          setProofStatus(ProofStatus.SUCCESS);
        } else {
          setProofStatus(ProofStatus.FAILED);
        }
        setLoadingProof(false);
      });
    } catch (error) {
      console.log(error);
      setLoadingProof(false);
    }
  }

  return (
    <div className="App">
      <Container>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '1000',
            pt: '60px',
            pb: '20px',
          }}
        >
          <Stack spacing={2} textAlign="left">
            <Stack spacing={2} direction="row" justifyContent="space-between">
              <Stack spacing={2} sx={{ width: '50%' }}>
                <Typography variant="h4">Prove</Typography>
                <form onSubmit={buildProof}>
                  <TextField
                    required
                    key={"x"}
                    name={"x"}
                    label={"private value X"}
                    helperText={"Private value that will be digested using sha256"}
                    variant="outlined"
                    margin="normal"
                    fullWidth
                  />
                  <TextField
                    required
                    key={"y"}
                    name={"y"}
                    label={"public value Y"}
                    helperText={"Public value that will be digested using sha256"}
                    variant="outlined"
                    margin="normal"
                    fullWidth
                  />

                  {loadingProof && <CircularProgress
                    size={30}
                  />}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={loadingProof}

                  >
                    Build Proof
                  </Button>
                </form>

              </Stack>
              <Divider orientation="vertical" flexItem />
              <Stack spacing={2} sx={{ width: '50%' }}>
                <Typography variant="h4">Verify</Typography>
                <form onSubmit={triggerVerifyProof}>
                  <TextField
                    required
                    key={"yv"}
                    name={"yv"}
                    label={"public digested value Y"}
                    helperText={"Digested value of sha256"}
                    variant="outlined"
                    margin="normal"
                    fullWidth
                  />
                  {loadingProof && <CircularProgress
                    size={30}
                  />}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={loadingProof || !proofValue}

                  >
                    Verify proof
                  </Button>
                </form>
                {ProofStatus.SUCCESS === proofStatus && <Chip label="Proof verified" color="success" sx={{
                  width: '25%'
                }} />}
                {ProofStatus.FAILED === proofStatus && <Chip label="Proof failed" color="error" sx={{
                  width: '25%'
                }} />}
              </Stack>
            </Stack>

            <Divider flexItem />
            <Stack spacing={2} direction="row">
              <Stack spacing={2}>
                {xHash && <>
                  <Typography variant="h6">xHash</Typography>
                  <Typography variant="body2"

                  >
                    {xHash}
                  </Typography>
                </>}
              </Stack>

            </Stack>
          </Stack>

        </Box>
      </Container>
    </div>
  );
}

export default App;
