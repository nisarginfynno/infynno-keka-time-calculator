import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calculator, Timer, CheckCircle2, AlertCircle, Coffee } from "lucide-react";

const TARGET_HOURS = 8;
const TARGET_MINUTES = 15;
const TARGET_TOTAL_MINUTES = TARGET_HOURS * 60 + TARGET_MINUTES;

const parseTime = (timeStr: string): Date | null => {
  const regex = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;
  const match = timeStr.trim().match(regex);
  
  if (!match) return null;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const period = match[4].toUpperCase();
  
  if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59) return null;
  
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  
  const date = new Date();
  date.setHours(hours, minutes, seconds, 0);
  return date;
};

const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.round(Math.abs(totalMinutes) % 60);
  return `${hours}h ${minutes}m`;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

interface BreakInfo {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface CalculationResult {
  validEntries: string[];
  invalidEntries: string[];
  totalWorkedMinutes: number;
  remainingMinutes: number;
  completionTime: Date | null;
  isComplete: boolean;
  isCurrentlyIn: boolean;
  totalBreakMinutes: number;
  breaks: BreakInfo[];
}

const Index = () => {
  const [punchLog, setPunchLog] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const calculate = () => {
    const lines = punchLog.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const validEntries: string[] = [];
    const invalidEntries: string[] = [];
    const parsedTimes: Date[] = [];

    lines.forEach((line) => {
      const parsed = parseTime(line);
      if (parsed) {
        validEntries.push(line);
        parsedTimes.push(parsed);
      } else {
        invalidEntries.push(line);
      }
    });

    let totalWorkedMs = 0;
    for (let i = 0; i < parsedTimes.length - 1; i += 2) {
      const inTime = parsedTimes[i];
      const outTime = parsedTimes[i + 1];
      if (outTime) {
        totalWorkedMs += outTime.getTime() - inTime.getTime();
      }
    }

    // Calculate breaks: gap between OUT and next IN
    const breaks: BreakInfo[] = [];
    let totalBreakMs = 0;
    for (let i = 1; i < parsedTimes.length - 1; i += 2) {
      const outTime = parsedTimes[i];
      const nextInTime = parsedTimes[i + 1];
      if (outTime && nextInTime) {
        const breakMs = nextInTime.getTime() - outTime.getTime();
        totalBreakMs += breakMs;
        breaks.push({
          startTime: formatTime(outTime),
          endTime: formatTime(nextInTime),
          durationMinutes: breakMs / 1000 / 60,
        });
      }
    }

    const isCurrentlyIn = parsedTimes.length % 2 === 1;
    if (isCurrentlyIn) {
      const lastIn = parsedTimes[parsedTimes.length - 1];
      totalWorkedMs += currentTime.getTime() - lastIn.getTime();
    }

    const totalWorkedMinutes = totalWorkedMs / 1000 / 60;
    const remainingMinutes = TARGET_TOTAL_MINUTES - totalWorkedMinutes;
    const isComplete = remainingMinutes <= 0;
    const totalBreakMinutes = totalBreakMs / 1000 / 60;

    let completionTime: Date | null = null;
    if (!isComplete && isCurrentlyIn) {
      completionTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000);
    }

    setResult({
      validEntries,
      invalidEntries,
      totalWorkedMinutes,
      remainingMinutes,
      completionTime,
      isComplete,
      isCurrentlyIn,
      totalBreakMinutes,
      breaks,
    });
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Clock className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold text-foreground">Work Hours Calculator</h1>
          </div>
          <p className="text-muted-foreground">
            Paste your punch log to calculate working hours
          </p>
        </div>

        {/* Current Time Display */}
        <Card className="border-2 border-accent/20 bg-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3">
              <Timer className="w-5 h-5 text-accent" />
              <span className="text-sm text-muted-foreground">Current Time:</span>
              <span className="font-mono text-xl font-semibold text-foreground">
                {formatTime(currentTime)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-accent" />
              Punch Log Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`Paste your punch times here (one per line):\n\n10:38:59 AM\n1:00:00 PM\n1:21:33 PM\n6:00:00 PM\nMISSING`}
              value={punchLog}
              onChange={(e) => setPunchLog(e.target.value)}
              className="min-h-[180px] font-mono text-sm bg-secondary/50 border-border focus:border-accent focus:ring-accent"
            />
            <Button
              onClick={calculate}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6"
            >
              Calculate Working Hours
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Worked */}
              <Card className="bg-card shadow-md border-l-4 border-l-accent">
                <CardContent className="py-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Worked
                    </p>
                    <p className="font-mono text-2xl font-bold text-foreground">
                      {formatDuration(result.totalWorkedMinutes)}
                    </p>
                    {result.isCurrentlyIn && (
                      <p className="text-xs text-accent flex items-center gap-1">
                        <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                        Currently clocked in
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Remaining Time */}
              <Card className={`bg-card shadow-md border-l-4 ${result.isComplete ? 'border-l-success' : 'border-l-warning'}`}>
                <CardContent className="py-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {result.isComplete ? "Overtime" : "Remaining"}
                    </p>
                    <p className={`font-mono text-2xl font-bold ${result.isComplete ? 'text-success' : 'text-warning'}`}>
                      {result.isComplete ? "+" : ""}{formatDuration(Math.abs(result.remainingMinutes))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Target: {TARGET_HOURS}h {TARGET_MINUTES}m
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Completion Time */}
              <Card className={`bg-card shadow-md border-l-4 ${result.isComplete ? 'border-l-success' : 'border-l-primary'}`}>
                <CardContent className="py-5">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {result.isComplete ? "Status" : "Est. Completion"}
                    </p>
                    {result.isComplete ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-success" />
                        <span className="font-mono text-xl font-bold text-success">Complete!</span>
                      </div>
                    ) : result.completionTime ? (
                      <p className="font-mono text-2xl font-bold text-foreground">
                        {formatTime(result.completionTime)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Clock in to estimate
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Break Time Section */}
            <Card className="bg-card shadow-md border-l-4 border-l-accent/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-accent" />
                  Break Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Total Break:</span>
                  <span className="font-mono text-xl font-bold text-foreground">
                    {formatDuration(result.totalBreakMinutes)}
                  </span>
                </div>
                {result.breaks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Individual Breaks</p>
                    <div className="space-y-1">
                      {result.breaks.map((brk, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-secondary/30 rounded px-3 py-2">
                          <span className="font-mono text-muted-foreground">
                            {brk.startTime} → {brk.endTime}
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatDuration(brk.durationMinutes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.breaks.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No breaks detected</p>
                )}
              </CardContent>
            </Card>

            {/* Parsed Entries Info */}
            <Card className="bg-card shadow-md">
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">Valid entries:</span>
                    <span className="font-semibold text-foreground">{result.validEntries.length}</span>
                  </div>
                  {result.invalidEntries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-muted-foreground">Ignored:</span>
                      <span className="font-semibold text-destructive">
                        {result.invalidEntries.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Times are paired as IN → OUT. Odd entries assume you're still clocked in.
        </p>
      </div>
    </div>
  );
};

export default Index;
