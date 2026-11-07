/** D-194's kill switch: anything but "off" shows each look's photos. Read at build time, so changing it needs a redeploy. */
export const lookPhotosOn = process.env.NEXT_PUBLIC_LOOK_PHOTOS !== 'off';
