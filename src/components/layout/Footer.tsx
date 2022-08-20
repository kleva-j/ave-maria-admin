import { Container, Footer, Title, Text } from '@mantine/core';

export const PageFooter = () => {
  return (
    <Footer height={60} p="md">
      <Container size="xl" style={{ display: 'flex' }}>
        <Title style={{ fontSize: '11px' }} order={6}>
          Built by{' '}
          <Text size="sm" color="yellow" underline inherit component="span">
            Kasmickleva
          </Text>
        </Title>
      </Container>
    </Footer>
  );
};
