import { useState } from "react";
import { NearestFilter, TextureLoader } from "three";
import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";

type RendererProps = {
  blockData: Awaited<ReturnType<typeof window.api.getBlockData>>;
};

export function Renderer({ blockData }: RendererProps) {
  return (
    <Canvas>
      <CanvasChildren blockData={blockData} />
    </Canvas>
  );
}

type ChildrenProps = {
  blockData: Awaited<ReturnType<typeof window.api.getBlockData>>;
};

function CanvasChildren({ blockData }: ChildrenProps) {
  const [rotation, setRotation] = useState(0);

  const colorMap = useLoader(TextureLoader, `data:image/png;base64,${blockData.texture64}`);

  colorMap.minFilter = NearestFilter;
  colorMap.magFilter = NearestFilter;

  useFrame(() => {
    setRotation(rotation + 0.001);
  });

  return (
    <>
      <ambientLight />
      <CameraControls />
      <pointLight position={[5, 0, 5]} intensity={100} />
      <mesh rotation={[rotation, rotation, 10]}>
        <boxGeometry />

        <meshStandardMaterial map={colorMap} />
      </mesh>
    </>
  );
}
