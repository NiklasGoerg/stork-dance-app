export type LandmarkFrame = {
  time: number;

  landmarks: {
    x: number;
    y: number;
    z: number;
  }[];
};

export type MovementRecording = {
  name: string;
  fps: number;
  createdAt: string;

  frames: LandmarkFrame[];
};
