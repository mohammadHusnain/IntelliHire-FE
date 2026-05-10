import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Mic, 
  Square, 
  X,
  AlertTriangle,
  Check,
  ArrowRight
} from "lucide-react";

// Audio Visualizer Component
const AudioVisualizer = ({ isRecording, hasPermission }) => {
  const [bars, setBars] = useState(Array(20).fill(0));
  
  useEffect(() => {
    if (!isRecording) {
      setBars(Array(20).fill(0));
      return;
    }
    
    const interval = setInterval(() => {
      setBars(Array(20).fill(0).map(() => Math.random() * 0.8 + 0.2));
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRecording]);
  
  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {bars.map((height, i) => (
        <div
          key={i}
          className={`w-[4px] rounded-full transition-all duration-100 ${
            isRecording ? "bg-[#FFA07A]" : "bg-[#E5E7EB]"
          }`}
          style={{ 
            height: isRecording ? `${height * 100}%` : '20%',
            opacity: isRecording ? 0.3 + height * 0.7 : 0.3
          }}
        />
      ))}
    </div>
  );
};

// Confirmation Modal
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-[12px] p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-[#DC2626]" />
          </div>
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827]">{title}</h3>
            <p className="text-[14px] text-[#6B7280] mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#6B7280] hover:text-[#F04E23] font-medium"
          >
            Continue Interview
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-[#F04E23] hover:bg-[#D43D14] text-white rounded-[8px] text-[14px] font-medium"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

// Loading Overlay
const LoadingOverlay = ({ isOpen }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50">
      <div className="w-12 h-12 border-4 border-[#E5E7EB] border-t-[#F04E23] rounded-full animate-spin mb-4" />
      <p className="text-[16px] text-[#374151]" style={{ fontFamily: 'Times New Roman, serif' }}>
        Analysing your session...
      </p>
    </div>
  );
};

function InterviewRoom() {
  const navigate = useNavigate();
  
  // Interview state
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const totalQuestions = 8;
  const [elapsedTime, setElapsedTime] = useState(0); // Start from 0
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [transcription, setTranscription] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Store answers for all questions
  const [answers, setAnswers] = useState({});
  
  const recordingTimerRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);

  // Mock questions
  const questions = [
    "Tell me about yourself and your background in software development.",
    "What motivated you to pursue a career in frontend development?",
    "Tell me about a time you had to debug a complex performance issue in a React application. Walk me through your approach.",
    "Describe a challenging project you worked on. What was your role and what was the outcome?",
    "How do you stay updated with the latest frontend technologies and best practices?",
    "Tell me about a time you had to work with a difficult team member. How did you handle it?",
    "What are your strengths and areas you'd like to improve?",
    "Where do you see yourself in 5 years, and how does this role fit into your career goals?"
  ];

  // Sample realistic answers for transcription simulation
  const sampleTranscriptions = [
    "I have a strong background in software development with over three years of experience working primarily with JavaScript and React. I started my career as a junior developer and have progressively taken on more responsibility, working on everything from small features to large-scale applications.",
    "I've always been fascinated by how users interact with technology. Frontend development allows me to combine my technical skills with creativity to build interfaces that people actually enjoy using. Seeing users happy with what I've built is incredibly rewarding.",
    "I encountered a memory leak in a React app that was causing the page to slow down over time. I used Chrome DevTools to profile the application and discovered that event listeners weren't being properly cleaned up in useEffect hooks. I implemented proper cleanup functions and the performance improved dramatically.",
    "I led a team of three developers to rebuild our company's e-commerce platform. We migrated from a legacy system to a modern React architecture. My role involved architecture decisions, code reviews, and mentoring junior developers. The project was delivered on time and increased conversion rates by 25 percent.",
    "I regularly read industry blogs, follow key developers on Twitter, and participate in online communities like Reddit's r/javascript and Reactiflux. I also dedicate time each week to experiment with new tools and build small side projects to stay current with emerging trends.",
    "I once worked with a teammate who had a very different communication style. Instead of letting frustration build up, I scheduled a one-on-one coffee chat to understand their perspective better. We established clear expectations and found a workflow that worked for both of us.",
    "My strengths include problem-solving, attention to detail, and strong communication skills. I'm also quick to learn new technologies. An area I'm working on is improving my knowledge of backend systems to become a more well-rounded full-stack developer.",
    "In five years, I see myself in a senior technical role where I can mentor others and influence architectural decisions. This position offers exactly the growth trajectory I'm looking for, with opportunities to work on challenging projects and develop my leadership skills."
  ];

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recording duration timer and transcription simulation
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Simulate realistic transcription - add words gradually
      const currentAnswer = sampleTranscriptions[currentQuestion - 1] || "";
      const words = currentAnswer.split(" ");
      let wordIndex = 0;
      
      transcriptionIntervalRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          setTranscription(prev => {
            const newWord = words[wordIndex];
            wordIndex++;
            return prev ? `${prev} ${newWord}` : newWord;
          });
        }
      }, 300); // Add a word every 300ms for realistic effect
      
    } else {
      clearInterval(recordingTimerRef.current);
      clearInterval(transcriptionIntervalRef.current);
      
      // Save answer when stopping recording
      if (transcription.trim()) {
        setAnswers(prev => ({
          ...prev,
          [currentQuestion]: transcription.trim()
        }));
      }
    }
    return () => {
      clearInterval(recordingTimerRef.current);
      clearInterval(transcriptionIntervalRef.current);
    };
  }, [isRecording, currentQuestion]);

  const handleToggleRecording = () => {
    if (!hasPermission) return;
    
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      // If we have a previous answer for this question, continue from there
      const previousAnswer = answers[currentQuestion] || "";
      setTranscription(previousAnswer);
    }
  };

  const handleNextQuestion = () => {
    // Save current answer before moving
    if (transcription.trim()) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion]: transcription.trim()
      }));
    }
    
    if (currentQuestion < totalQuestions) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setIsRecording(false);
      setRecordingDuration(0);
      // Load previous answer for next question if exists
      setTranscription(answers[nextQuestion] || "");
    } else {
      // Finish interview - save all answers and navigate
      const finalAnswers = { ...answers };
      if (transcription.trim()) {
        finalAnswers[currentQuestion] = transcription.trim();
      }
      
      setShowLoading(true);
      setTimeout(() => {
        setShowLoading(false);
        navigate("/candidate/report/123", { 
          state: { 
            answers: finalAnswers,
            questions: questions
          } 
        });
      }, 2000);
    }
  };

  const handleSkipQuestion = () => {
    if (currentQuestion < totalQuestions) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setIsRecording(false);
      setRecordingDuration(0);
      setTranscription(answers[nextQuestion] || "");
    }
  };

  const handleEndSession = () => {
    setShowConfirmModal(true);
  };

  const confirmEndSession = () => {
    setShowConfirmModal(false);
    navigate("/candidate/dashboard");
  };

  const progress = (currentQuestion / totalQuestions) * 100;
  const isLastQuestion = currentQuestion === totalQuestions;
  const canProceed = recordingDuration > 0 || transcription.length > 0;

  return (
    <div className="min-h-screen bg-white flex flex-col font-['Times_New_Roman']">
      {/* Microphone Permission Error Banner */}
      {!hasPermission && (
        <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🎙️</span>
          <p className="text-[13px] text-[#92400E]">
            Microphone access is required. Please allow microphone permissions in your browser settings and refresh the page.
          </p>
        </div>
        <button className="text-[13px] text-[#F04E23] hover:underline">
          How to allow?
        </button>
      </div>
      )}

      {/* Loading Overlay */}
      <LoadingOverlay isOpen={showLoading} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmEndSession}
        title="End Interview Session?"
        message="Your progress will not be saved. Are you sure you want to leave?"
      />

      {/* Top Strip */}
      <header className="h-16 bg-white border-b border-[#EEEEEE] flex items-center px-6 sticky top-0 z-40">
        {/* Left - Wordmark */}
        <div className="w-1/4">
          <span className="text-[13px] text-[#9CA3AF]">IntelliHire</span>
        </div>

        {/* Center - Progress */}
        <div className="flex-1 flex flex-col items-center max-w-md">
          <span className="text-[15px] font-medium text-[#374151]">
            Question {currentQuestion} of {totalQuestions}
          </span>
          <div className="w-full h-1 bg-[#E5E7EB] rounded-full mt-2 overflow-hidden">
            <div 
              className="h-full bg-[#F04E23] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right - Timer & End Session */}
        <div className="w-1/4 flex items-center justify-end gap-4">
          <span className="text-[15px] text-[#374151] font-mono">
            {formatTime(elapsedTime)}
          </span>
          <button
            onClick={handleEndSession}
            className="text-[13px] text-[#F04E23] hover:underline"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[720px] space-y-8">
          {/* AI Question Card */}
          <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative">
            {/* AI Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 text-[#9CA3AF]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFF4F1" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="text-[11px] uppercase tracking-wider">AI Interview</span>
            </div>

            {/* Question Label */}
            <div className="mb-4 mt-6">
              <span className="text-[11px] text-[#F04E23] uppercase tracking-wider font-medium">
                Question {currentQuestion}
              </span>
            </div>

            {/* Question Text */}
            <p 
              className="text-[22px] text-[#111827] leading-[1.5]"
              style={{ fontFamily: 'Times New Roman, serif' }}
            >
              {questions[currentQuestion - 1]}
            </p>
          </div>

          {/* Microphone Control Area */}
          <div className="space-y-4">
            {/* Record Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleToggleRecording}
                disabled={!hasPermission}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? "bg-[#F04E23] hover:bg-[#D43D14] animate-pulse"
                    : "bg-[#FFA07A] hover:bg-[#FF9900]"
                } ${!hasPermission ? "opacity-50 cursor-not-allowed" : "shadow-lg hover:shadow-xl"}`}
              >
                {isRecording ? (
                  <Square size={24} className="text-white fill-white" />
                ) : (
                  <Mic size={28} className="text-white" />
                )}
              </button>
              
              <p className={`text-[14px] ${isRecording ? "text-[#F04E23]" : "text-[#6B7280]"}`}>
                {isRecording ? "Recording... Click to Stop" : "Click to Answer"}
              </p>
            </div>

            {/* Audio Visualizer */}
            <AudioVisualizer isRecording={isRecording} hasPermission={hasPermission} />

            {/* Transcription Box */}
            <div className="relative">
              <textarea
                value={transcription}
                readOnly
                placeholder="Your response will appear here as you speak..."
                className="w-full h-[120px] p-4 rounded-[8px] border border-[#EEEEEE] bg-[#FFF4F1] text-[14px] text-[#374151] resize-none outline-none"
                style={{ fontFamily: 'Times New Roman, serif' }}
              />
              {transcription && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] text-[#16A34A]">
                  <Check size={12} />
                  <span>Captured</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleSkipQuestion}
              className="px-4 py-2 border border-[#D1D5DB] text-[#6B7280] rounded-[6px] text-[13px] hover:border-[#9CA3AF] hover:text-[#F04E23] transition-colors"
            >
              Skip Question
            </button>
            
            <button
              onClick={handleNextQuestion}
              disabled={!canProceed}
              className={`px-6 py-2.5 rounded-[8px] text-[15px] font-medium flex items-center gap-2 transition-colors ${
                canProceed
                  ? "bg-[#F04E23] hover:bg-[#D43D14] text-white"
                  : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
              }`}
            >
              {isLastQuestion ? "Finish Interview" : "Next Question"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InterviewRoom;
