import { useState, useEffect, useRef, MouseEvent } from 'react';
import { FileInput } from '@mantine/core';
import { imgUrl } from 'helpers';

export const useFileUpload = ({ defaultImage = imgUrl }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLButtonElement | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(defaultImage);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLoading(true);
        setImagePreview(reader.result as string);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    }
  }, [file]);

  const Component = (
    <FileInput
      ref={fileInputRef}
      sx={{ display: 'none' }}
      aria-label="image upload"
      accept="image/*"
      onChange={(file) => setFile(file)}
    />
  );
  return {
    Component,
    onClick,
    loading,
    imagePreview,
  };
};
