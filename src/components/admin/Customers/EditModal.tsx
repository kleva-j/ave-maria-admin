import { Modal, Button, Group } from '@mantine/core';
import { useState } from 'react';

export const EditModal = ({}) => {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Introduce yourself!"
        centered
      >
        {/* Modal content */}
      </Modal>

      <Group position="center">
        <Button onClick={() => setOpened(true)}>Open Modal</Button>
      </Group>
    </>
  );
};
