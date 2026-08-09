export const usePageSubtitle = () => {
  const subtitle = useState<string>('pageSubtitle', () => 'Member portal');
  
  const setSubtitle = (text: string) => {
    subtitle.value = text;
  };

  return { subtitle, setSubtitle };
};
