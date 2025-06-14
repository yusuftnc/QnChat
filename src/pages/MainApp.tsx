import { useState, useEffect, useRef } from 'react';
import { 
  Box, IconButton, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, 
  Typography, Grid, Button, TextField, Paper, FormControl, Select, 
  InputLabel, Chip, Divider, Tabs, Tab, CircularProgress
} from '@mui/material';
import { 
  Logout, Add, Send, SmartToy, Psychology, Code, 
  Science, MenuBook, QuestionAnswer, Chat as ChatIcon, Book, Star
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { sendChatMessage, sendQnAQuestion, getAvailableModels, checkApiHealth, sendChatMessageStream, sendQnAQuestionStream, sendOpenAIMessageStream } from '../services/api';

// Chat message tipi
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

// Chat conversation tipi
interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
}

// QnA item tipi
interface QnAItem {
  id: string;
  question: string;
  answer: string;
  model: string;
  timestamp: Date;
}

export const MainApp = () => {
  const { logout, user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0); // 0 = Chat, 1 = QnA
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [isApiHealthy, setIsApiHealthy] = useState(false);
  
  // Chat container ref for auto-scroll
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // QnA container ref for auto-scroll
  const qnaContainerRef = useRef<HTMLDivElement>(null);
  
  // StrictMode duplicate prevention
  const initialConversationCreated = useRef(false);
  const modelsLoadStarted = useRef(false);
  
  // Chat state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState(''); // Backend default model

  // Online Chat state (Tab 2)
  const [onlineConversations, setOnlineConversations] = useState<ChatConversation[]>([]);
  const [activeOnlineConversationId, setActiveOnlineConversationId] = useState<string | null>(null);
  const [currentOnlineMessage, setCurrentOnlineMessage] = useState('');

  // QnA state
  const [qnaItems, setQnaItems] = useState<QnAItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  // Documents state (Tab 4)
  const [documents, setDocuments] = useState<Array<{id: string, name: string, uploadDate: Date}>>([
    { id: '1', name: 'Kullanım Kılavuzu.pdf', uploadDate: new Date() },
    { id: '2', name: 'Teknik Doküman.docx', uploadDate: new Date(Date.now() - 86400000) }
  ]);

  // Dynamic models state
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, icon: React.ReactNode}>>([]);

  // OpenAI models state (Tab 2)
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState('gpt-4.1-nano');
  const [openAIModels] = useState<Array<{id: string, name: string, icon: React.ReactNode}>>([
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (Eko)', icon: <SmartToy /> },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (Hızlı)', icon: <Psychology /> }
  ]);

  // Model icon mapping helper
  const getModelIcon = (modelId: string) => {
    if (modelId.includes('1b')) return <SmartToy />;
    if (modelId.includes('3b')) return <Psychology />;
    if (modelId.includes('8b')) return <MenuBook />;
    if (modelId.includes('70b')) return <Science />;
    return <Code />; // Default icon
  };

  // Avatar menü kontrolü
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  // Yeni conversation başlat
  const createNewConversation = () => {
    const newConversation: ChatConversation = {
      id: Date.now().toString(),
      title: 'Yeni Sohbet',
      messages: [],
      model: selectedModel,
      createdAt: new Date()
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  };

  // Yeni online conversation başlat
  const createNewOnlineConversation = () => {
    const newConversation: ChatConversation = {
      id: Date.now().toString(),
      title: 'Yeni Çevrimiçi Sohbet',
      messages: [],
      model: selectedOpenAIModel, // Seçili OpenAI model
      createdAt: new Date()
    };
    setOnlineConversations(prev => [newConversation, ...prev]);
    setActiveOnlineConversationId(newConversation.id);
  };

  // İlk açılışta otomatik conversation başlat
  useEffect(() => {
    if (activeTab === 0 && conversations.length === 0 && !initialConversationCreated.current) {
      initialConversationCreated.current = true;
      createNewConversation();
    }
  }, []); // Sadece component mount'ta çalışır

  // İlk açılışta otomatik online conversation başlat
  useEffect(() => {
    if (activeTab === 1 && onlineConversations.length === 0) {
      createNewOnlineConversation();
    }
  }, [activeTab]); // activeTab değiştiğinde çalışır

  // Load available models from backend - StrictMode safe
  useEffect(() => {
    if (!modelsLoadStarted.current) {
      modelsLoadStarted.current = true;
      
      const loadModels = async () => {
        try {
          setModelsLoading(true);
          const response = await getAvailableModels();
          
          // Backend response: { "status": true, "data": { "models": [...] } }
          if (response.status && response.data && response.data.models) {
            const formattedModels = response.data.models.map((model: any) => ({
              id: model.name || model.model,
              name: model.name || model.model,
              icon: getModelIcon(model.name || model.model)
            }));
            
            setAvailableModels(formattedModels);
            
            // İlk modeli default olarak seç (eğer şu anki seçili model listede yoksa)
            if (formattedModels.length > 0 && !formattedModels.some((m: any) => m.id === selectedModel)) {
              setSelectedModel(formattedModels[0].id);
            }
          } else {
            throw new Error('Invalid response format');
          }
        } catch (error) {
          console.error('Models yüklenemedi:', error);
          // Fallback models
          /*setAvailableModels([
            { id: 'llama3.2:1b', name: 'Llama 3.2 1B', icon: <SmartToy /> },
            { id: 'llama3.2:3b', name: 'Llama 3.2 3B', icon: <Psychology /> },
            { id: 'llama3.1:8b', name: 'Llama 3.1 8B', icon: <MenuBook /> },
            { id: 'llama3.1:70b', name: 'Llama 3.1 70B', icon: <Science /> }
          ]);*/
        } finally {
          setModelsLoading(false);
        }
      };

      loadModels();
    }
  }, []); // Sadece component mount'ta çalışır

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current && activeTab === 0 && activeConversationId) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [conversations, activeConversationId, activeTab]); // Messages değiştiğinde scroll

  // Auto-scroll to bottom when QnA items change
  useEffect(() => {
    if (qnaContainerRef.current && activeTab === 1) {
      const container = qnaContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [qnaItems, activeTab]); // QnA items değiştiğinde scroll

  // Chat mesaj gönder - GERÇEK API ENTEGRASYONU
  const sendMessage = async () => {
    if (!currentMessage.trim() || !activeConversationId || isLoading) return;

    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setConversations(prev => prev.map(conv =>
      conv.id === activeConversationId
        ? { ...conv, messages: [...conv.messages, userMessage] }
        : conv
    ));

    const currentMsgToSend = currentMessage;
    setCurrentMessage('');

    // Boş bir assistant mesajı ekle (cevap için)
    const aiMessageId = (Date.now() + 1).toString();
    setConversations(prev => prev.map(conv =>
      conv.id === activeConversationId
        ? { ...conv, messages: [...conv.messages, {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            model: selectedModel
          }] }
        : conv
    ));

    try {
      await sendChatMessageStream(
        [...(conversations.find(c => c.id === activeConversationId)?.messages || []), { role: 'user', content: currentMsgToSend }],
        selectedModel,
        (chunk) => {
          setConversations(prev => prev.map(conv =>
            conv.id === activeConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map(msg =>
                    msg.id === aiMessageId
                      ? { ...msg, content: (msg.content || '') + (chunk.message?.content || chunk.response || '') }
                      : msg
                  )
                }
              : conv
          ));
        }
      );
    } catch (error) {
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === aiMessageId
                  ? { ...msg, content: `❌ API Hatası: Sunucuya bağlanamadı. (${error instanceof Error ? error.message : 'Bilinmeyen hata'})` }
                  : msg
              )
            }
          : conv
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // Online Chat mesaj gönder - OpenAI API ENTEGRASYONU
  const sendOnlineMessage = async () => {
    if (!currentOnlineMessage.trim() || !activeOnlineConversationId || isLoading) return;

    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentOnlineMessage,
      timestamp: new Date()
    };

    setOnlineConversations(prev => prev.map(conv =>
      conv.id === activeOnlineConversationId
        ? { ...conv, messages: [...conv.messages, userMessage] }
        : conv
    ));

    const currentMsgToSend = currentOnlineMessage;
    setCurrentOnlineMessage('');

    // Boş bir assistant mesajı ekle (cevap için)
    const aiMessageId = (Date.now() + 1).toString();
    setOnlineConversations(prev => prev.map(conv =>
      conv.id === activeOnlineConversationId
        ? { ...conv, messages: [...conv.messages, {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            model: selectedOpenAIModel
          }] }
        : conv
    ));

    try {
      // OpenAI API entegrasyonu
      const activeOnlineConv = onlineConversations.find(conv => conv.id === activeOnlineConversationId);
      const chatHistory = activeOnlineConv?.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })) || [];

      // Yeni mesajı history'ye ekle
      const allMessages = [...chatHistory, { role: 'user' as const, content: currentMsgToSend }];

      await sendOpenAIMessageStream(
        allMessages,
        selectedOpenAIModel,
        (chunk) => {
          setOnlineConversations(prev => prev.map(conv =>
            conv.id === activeOnlineConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map(msg =>
                    msg.id === aiMessageId
                      ? { ...msg, content: (msg.content || '') + (chunk.content || '') }
                      : msg
                  )
                }
              : conv
          ));
        }
      );
    } catch (error) {
      setOnlineConversations(prev => prev.map(conv =>
        conv.id === activeOnlineConversationId
          ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === aiMessageId
                  ? { ...msg, content: `❌ OpenAI API Hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` }
                  : msg
              )
            }
          : conv
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // QnA soru gönder - GERÇEK API ENTEGRASYONU
  const sendQuestion = async () => {
    if (!currentQuestion.trim() || isLoading) return;

    setIsLoading(true);
    const questionToSend = currentQuestion;
    setCurrentQuestion('');

    // QnA item'ı ekle ve hemen pendingQuestion'ı temizle
    const qnaId = Date.now().toString();
    setQnaItems(prev => [
      ...prev,
      {
        id: qnaId,
        question: questionToSend,
        answer: '',
        model: selectedModel,
        timestamp: new Date()
      }
    ]);
    setPendingQuestion(null);

    try {
      await sendQnAQuestionStream(
        questionToSend,
        selectedModel,
        (chunk) => {
          setQnaItems(prev => prev.map(item =>
            item.id === qnaId
              ? { ...item, answer: (item.answer || '') + (chunk.response || chunk.message?.content || '') }
              : item
          ));
        }
      );
    } catch (error) {
      setQnaItems(prev => prev.map(item =>
        item.id === qnaId
          ? { ...item, answer: `❌ API Hatası: Sunucuya bağlanamadı. (${error instanceof Error ? error.message : 'Bilinmeyen hata'})` }
          : item
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      if (activeTab === 0) {
        sendMessage();
      } else if (activeTab === 1) {
        sendOnlineMessage();
      } else if (activeTab === 2) {
        sendQuestion();
      }
    }
  };

  // Kullanıcı adından initials oluştur
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const activeConversation = conversations.find(conv => conv.id === activeConversationId);
  const activeOnlineConversation = onlineConversations.find(conv => conv.id === activeOnlineConversationId);

  // API health check
  useEffect(() => {
    const checkHealth = async () => {
      const isHealthy = await checkApiHealth();
      setIsApiHealthy(isHealthy);
    };

    // İlk kontrol
    checkHealth();

    // Her 30 saniyede bir kontrol et
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'  // Page scroll'u tamamen kapat
    }}>
      <Grid container sx={{ 
        flexGrow: 1, 
        width: '100vw',
        overflow: 'hidden'  // Grid level scroll'u da kapat
      }}>
        
        {/* Sol Sidebar - Chat Geçmişi / QnA Geçmişi */}
        <Grid size={2.5} sx={{ borderRight: 1, borderColor: 'divider', backgroundColor: 'grey.50' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Logo Header */}
            <Box sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'primary.main',
              color: 'white'
            }}>
              <img src="/qchat-logo.svg" alt="QChat" width="32" height="32" style={{ filter: 'brightness(0) invert(1)' }} />
              <Typography variant="h6" fontWeight="bold">
                QChat
              </Typography>
            </Box>
            
            {/* New Chat/QnA Button */}
            <Box sx={{ p: 2 }}>
              {activeTab === 0 ? (
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<Add />}
                  onClick={createNewConversation}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Yeni Sohbet
                </Button>
              ) : activeTab === 1 ? (
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<Add />}
                  onClick={createNewOnlineConversation}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Yeni Çevrimiçi Sohbet
                </Button>
              ) : (
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<QuestionAnswer />}
                  sx={{ justifyContent: 'flex-start' }}
                  disabled
                >
                  Geçmiş
                </Button>
              )}
            </Box>

            <Divider />

            {/* History */}
            <Box sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              p: 1,
              minHeight: 0,  // Flex child için gerekli
              maxHeight: 'calc(100vh - 180px)', // Button + divider + footer alanı hariç
              // Custom Scrollbar Styling
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '10px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#1976d2',  // Primary blue
                borderRadius: '10px',
                '&:hover': {
                  background: '#1565c0',  // Darker blue on hover
                },
              },
            }}>
              {activeTab === 0 ? (
                // Local Chat History
                conversations.map((conv) => (
                  <Paper
                    key={conv.id}
                    elevation={activeConversationId === conv.id ? 2 : 0}
                    sx={{
                      p: 2,
                      mb: 1,
                      cursor: 'pointer',
                      backgroundColor: activeConversationId === conv.id ? 'primary.light' : 'transparent',
                      '&:hover': { backgroundColor: 'grey.100' }
                    }}
                    onClick={() => setActiveConversationId(conv.id)}
                  >
                    <Typography variant="body2" noWrap>
                      {conv.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {conv.messages.length} mesaj
                    </Typography>
                  </Paper>
                ))
              ) : activeTab === 1 ? (
                // Online Chat History
                onlineConversations.map((conv) => (
                  <Paper
                    key={conv.id}
                    elevation={activeOnlineConversationId === conv.id ? 2 : 0}
                    sx={{
                      p: 2,
                      mb: 1,
                      cursor: 'pointer',
                      backgroundColor: activeOnlineConversationId === conv.id ? 'primary.light' : 'transparent',
                      '&:hover': { backgroundColor: 'grey.100' }
                    }}
                    onClick={() => setActiveOnlineConversationId(conv.id)}
                  >
                    <Typography variant="body2" noWrap>
                      {conv.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {conv.messages.length} mesaj
                    </Typography>
                  </Paper>
                ))
              ) : (
                // QnA History (Tab 2) or Document Library (Tab 3)
                qnaItems.map((item) => (
                  <Paper
                    key={item.id}
                    elevation={1}
                    sx={{
                      p: 2,
                      mb: 1,
                      backgroundColor: 'transparent',
                      '&:hover': { backgroundColor: 'grey.100' }
                    }}
                  >
                    <Typography variant="body2" noWrap>
                      {item.question}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                ))
              )}
            </Box>
          </Box>
        </Grid>

        {/* Orta Alan - Chat/QnA Interface */}
        <Grid size={7}>
          <Box sx={{ 
            height: '100%',
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'grey.300'
          }}>
            
            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)}
                aria-label="QnA Chat tabs"
              >
                <Tab 
                  icon={<ChatIcon />} 
                  label="Yerel Sohbet" 
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
                <Tab 
                  icon={<ChatIcon />} 
                  label="Çevrimiçi Sohbet" 
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
                <Tab 
                  icon={<QuestionAnswer />} 
                  label="Soru Cevap" 
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
                <Tab 
                  icon={<Book />} 
                  label="Belge Kitaplığı" 
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
              </Tabs>
            </Box>

            {/* Model Selection Header */}
            <Box sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              {activeTab === 0 ? (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>AI Model</InputLabel>
                  <Select
                    value={selectedModel}
                    label="AI Model"
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        Modeller yükleniyor...
                      </MenuItem>
                    ) : (
                      availableModels.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {model.icon}
                            {model.name}
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              ) : activeTab === 1 ? (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>OpenAI Model</InputLabel>
                  <Select
                    value={selectedOpenAIModel}
                    label="OpenAI Model"
                    onChange={(e) => setSelectedOpenAIModel(e.target.value)}
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        Modeller yükleniyor...
                      </MenuItem>
                    ) : (
                      openAIModels.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {model.icon}
                            {model.name}
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              ) : activeTab === 2 ? (
                <Box sx={{ minWidth: 200, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Sorularınız yüklü belgeleriniz içerisinden cevaplanır.
                  </Typography>
                </Box>
              ) : null}
              
              <Chip 
                label={
                  activeTab === 0 ? 
                    (activeConversation ? `${activeConversation.messages.length} mesaj` : 'Yerel Chat Modu') :
                  activeTab === 1 ?
                    (activeOnlineConversation ? 
                      `${activeOnlineConversation.messages.length} mesaj` : 
                      'Çevrimiçi Chat Modu') :
                  activeTab === 2 ?
                    `${qnaItems.length} soru` :
                    `${documents.length} Belge`
                }
                size="small"
                color="primary"
                sx={{
                  alignSelf: 'flex-start',
                  marginLeft: 'auto'
                }}
              />
            </Box>

            {/* Content Area */}
            <Box 
              ref={activeTab === 0 ? chatContainerRef : qnaContainerRef}
              sx={{ 
                flexGrow: 1,
                overflow: 'auto',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minHeight: 0,  // Flex child için kritik!
                maxHeight: 'calc(100vh - 240px)', // Daha hassas calculation
                // Custom Scrollbar Styling
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#1976d2',  // Primary blue
                  borderRadius: '10px',
                  '&:hover': {
                    background: '#1565c0',  // Darker blue on hover
                  },
                },
              }}>
              {activeTab === 0 ? (
                // Local Chat Messages
                !activeConversation ? (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    <ChatIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                      Yerel Chat Moduna Hoş Geldin!
                    </Typography>
                    <Typography color="text.secondary">
                      Yeni bir sohbet başlatmak için "Yeni Sohbet" butonuna tıklayın
                    </Typography>
                  </Box>
                ) : (
                  activeConversation.messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1
                      }}
                    >
                      <Paper
                        elevation={1}
                        sx={{
                          p: 2,
                          maxWidth: '70%',
                          backgroundColor: message.role === 'user' ? 'primary.main' : 'grey.100',
                          color: message.role === 'user' ? 'white' : 'text.primary',
                        }}
                      >
                        <Typography variant="body1">
                          {message.content}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            opacity: 0.7,
                            display: 'block',
                            mt: 1
                          }}
                        >
                          {message.timestamp.toLocaleTimeString()}
                          {message.model && ` • ${message.model}`}
                        </Typography>
                      </Paper>
                    </Box>
                  ))
                )
              ) : activeTab === 1 ? (
                // Online Chat Messages
                !activeOnlineConversation ? (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    <ChatIcon sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                      Çevrimiçi Chat Moduna Hoş Geldin!
                    </Typography>
                    <Typography color="text.secondary">
                      ChatGPT ile sohbet etmek için "Yeni Çevrimiçi Sohbet" butonuna tıklayın
                    </Typography>
                  </Box>
                ) : (
                  activeOnlineConversation.messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1
                      }}
                    >
                      <Paper
                        elevation={1}
                        sx={{
                          p: 2,
                          maxWidth: '70%',
                          backgroundColor: message.role === 'user' ? 'primary.main' : 'success.light',
                          color: message.role === 'user' ? 'white' : 'text.primary',
                        }}
                      >
                        <Typography variant="body1">
                          {message.content}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            opacity: 0.7,
                            display: 'block',
                            mt: 1
                          }}
                        >
                          {message.timestamp.toLocaleTimeString()}
                          {message.model && ` • ${message.model}`}
                        </Typography>
                      </Paper>
                    </Box>
                  ))
                )
              ) : activeTab === 2 ? (
                // QnA Items
                qnaItems.length === 0 ? (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center'
                  }}>
                    <QuestionAnswer sx={{ fontSize: 80, color: 'grey.300', mb: 2 }} />
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                      QnA Moduna Hoş Geldin!
                    </Typography>
                    <Typography color="text.secondary">
                      Aşağıdan bir soru sorarak başlayın
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {qnaItems.map((item) => (
                      <Box key={item.id} sx={{ mb: 3 }}>
                        {/* Question */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                          <Paper
                            elevation={1}
                            sx={{
                              p: 2,
                              maxWidth: '70%',
                              backgroundColor: 'primary.main',
                              color: 'white',
                            }}
                          >
                            <Typography variant="body1">
                              {item.question}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 1 }}>
                              {item.timestamp.toLocaleTimeString()}
                            </Typography>
                          </Paper>
                        </Box>
                        {/* Answer */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Paper
                            elevation={1}
                            sx={{
                              p: 2,
                              maxWidth: '70%',
                              backgroundColor: 'grey.100',
                              color: 'text.primary',
                            }}
                          >
                            <Typography variant="body1">
                              {item.answer}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 1 }}>
                              {item.model}
                            </Typography>
                          </Paper>
                        </Box>
                      </Box>
                    ))}
                    
                    {/* Pending Question - API cevabı beklerken göster */}
                    {pendingQuestion && (
                      <Box sx={{ mb: 3 }}>
                        {/* Loading Answer */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <Paper
                            elevation={1}
                            sx={{
                              p: 2,
                              maxWidth: '70%',
                              backgroundColor: 'grey.100',
                              color: 'text.primary',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2
                            }}
                          >
                            <CircularProgress size={20} />
                            <Typography variant="body1" color="text.secondary">
                              Cevap hazırlanıyor...
                            </Typography>
                          </Paper>
                        </Box>
                      </Box>
                    )}
                  </>
                )
              ) : (
                <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="h5" color="text.secondary">Yakında...</Typography>
                </Box>
              )}
            </Box>

            {/* Input Area */}
            <Box sx={{ 
              p: 2, 
              borderTop: 1, 
              borderColor: 'divider',
              backgroundColor: 'background.paper'
            }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  multiline
                  maxRows={4}
                  fullWidth
                  placeholder={
                    activeTab === 0 ? "Mesajınızı yazın..." : 
                    activeTab === 1 ? "ChatGPT'ye mesajınızı yazın..." :
                    activeTab === 2 ? "Sorunuzu yazın..." :
                    "Buraya yazın..."
                  }
                  value={
                    activeTab === 0 ? currentMessage : 
                    activeTab === 1 ? currentOnlineMessage :
                    activeTab === 2 ? currentQuestion :
                    ""
                  }
                  onChange={(e) => {
                    if (activeTab === 0) setCurrentMessage(e.target.value);
                    else if (activeTab === 1) setCurrentOnlineMessage(e.target.value);
                    else if (activeTab === 2) setCurrentQuestion(e.target.value);
                  }}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading || (
                    activeTab === 0 && !activeConversationId ||
                    activeTab === 1 && !activeOnlineConversationId
                  )}
                  variant="outlined"
                  size="small"
                  helperText={isLoading ? "API'ye gönderiliyor..." : ""}
                />
                <IconButton 
                  color="primary" 
                  onClick={activeTab === 0 ? sendMessage : activeTab === 1 ? sendOnlineMessage : sendQuestion}
                  disabled={isLoading || (
                    activeTab === 0 ? (!currentMessage.trim() || !activeConversationId) : 
                    activeTab === 1 ? (!currentOnlineMessage.trim() || !activeOnlineConversationId) : 
                    activeTab === 2 ? !currentQuestion.trim() :
                    true
                  )}
                  sx={{ 
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                    '&:disabled': { backgroundColor: 'grey.300' }
                  }}
                >
                  {isLoading ? <CircularProgress size={20} color="inherit" /> : <Send />}
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Sağ Panel - User Profile */}
        <Grid size={2.5} sx={{ borderLeft: 1, borderColor: 'divider', backgroundColor: 'grey.50' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* User Header */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              p: 3,
              borderBottom: 1,
              borderColor: 'divider'
            }}>
              <Avatar 
                sx={{ 
                  bgcolor: 'primary.main', 
                  width: 60, 
                  height: 60,
                  mb: 2,
                  cursor: 'pointer'
                }}
                onClick={handleAvatarClick}
              >
                {getInitials(user?.name, user?.username)}
              </Avatar>
              
              <Typography variant="h6" gutterBottom>
                {user?.name || 'Kullanıcı'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.username}
              </Typography>
              
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Çıkış" />
                </MenuItem>
              </Menu>
            </Box>

            {/* Stats/Info */}
            <Box sx={{ p: 2, flexGrow: 1, textAlign: 'right' }}>
              <Typography variant="subtitle2" gutterBottom>
                İstatistikler
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  💬 Yerel Sohbet: {conversations.length}
                </Typography>
                <Typography variant="body2">
                  🌐 Çevrimiçi Sohbet: {onlineConversations.length}
                </Typography>
                <Typography variant="body2">
                  ❓ Toplam Soru: {qnaItems.length}
                </Typography>
                <Typography variant="body2">
                  🤖 Aktif Model: {
                    activeTab === 0 ? 
                      (availableModels.find(m => m.id === selectedModel)?.name || 'Seçilmemiş') : 
                    activeTab === 1 ? 
                      (openAIModels.find(m => m.id === selectedOpenAIModel)?.name || 'ChatGPT') : 
                    activeTab === 2 ? 
                      'ChatGPT 4.1' : 
                      'N/A'
                  }
                </Typography>
                <Typography variant="body2" color={isLoading ? 'warning.main' : (isApiHealthy ? 'success.main' : 'error.main')}>
                  {isLoading ? '⚡ API Çalışıyor...' : (isApiHealthy ? '🟢 API Hazır' : '🔴 API Bağlantısı Yok')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ⚡ QChat v1.0
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Footer */}
      <Box sx={{ 
        p: 1, 
        borderTop: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        textAlign: 'center'
      }}>
        <Typography variant="caption" color="text.secondary">
          Telif Hakkı © 2025 <a href="https://www.linkedin.com/in/yusuftnc/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Yusuf TUNÇ</a>. Tüm hakları saklıdır.
        </Typography>
      </Box>
    </Box>
  );
}; 