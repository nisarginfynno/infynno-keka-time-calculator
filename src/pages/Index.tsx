import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock, Calculator, Timer, CheckCircle2, AlertCircle, Coffee, Sun, Sunset, LogOut } from "lucide-react";

const FULL_DAY_HOURS = 8;
const FULL_DAY_MINUTES = 15;
const FULL_DAY_TOTAL_MINUTES = FULL_DAY_HOURS * 60 + FULL_DAY_MINUTES;

const HALF_DAY_HOURS = 4;
const HALF_DAY_MINUTES = 30;
const HALF_DAY_TOTAL_MINUTES = HALF_DAY_HOURS * 60 + HALF_DAY_MINUTES;

const EARLY_LEAVE_HOURS = 7;
const EARLY_LEAVE_MINUTES = 0;
const EARLY_LEAVE_TOTAL_MINUTES = EARLY_LEAVE_HOURS * 60 + EARLY_LEAVE_MINUTES;

type DayType = "full" | "half";
type HalfType = "first" | "second" | null;

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
  targetMinutes: number;
  halfType: HalfType;
  earlyLeaveRemainingMinutes: number;
  earlyLeaveTime: Date | null;
  canEarlyLeaveNow: boolean;
}

const Index = () => {
  const [punchLog, setPunchLog] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [dayType, setDayType] = useState<DayType>("full");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const detectHalfType = (firstPunchTime: Date): HalfType => {
    const hours = firstPunchTime.getHours();
    return hours < 12 ? "first" : "second";
  };

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
    const totalBreakMinutes = totalBreakMs / 1000 / 60;

    // Determine target based on day type
    const targetMinutes = dayType === "full" ? FULL_DAY_TOTAL_MINUTES : HALF_DAY_TOTAL_MINUTES;
    const remainingMinutes = targetMinutes - totalWorkedMinutes;
    const isComplete = remainingMinutes <= 0;

    // Detect half type if half day is selected
    const halfType: HalfType = dayType === "half" && parsedTimes.length > 0 
      ? detectHalfType(parsedTimes[0]) 
      : null;

    let completionTime: Date | null = null;
    if (!isComplete && isCurrentlyIn) {
      completionTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000);
    }

    // Early leave calculations (only for full day)
    const earlyLeaveRemainingMinutes = dayType === "full" 
      ? EARLY_LEAVE_TOTAL_MINUTES - totalWorkedMinutes 
      : 0;
    const canEarlyLeaveNow = dayType === "full" && earlyLeaveRemainingMinutes <= 0;
    
    let earlyLeaveTime: Date | null = null;
    if (dayType === "full" && !canEarlyLeaveNow && isCurrentlyIn) {
      earlyLeaveTime = new Date(currentTime.getTime() + earlyLeaveRemainingMinutes * 60 * 1000);
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
      targetMinutes,
      halfType,
      earlyLeaveRemainingMinutes,
      earlyLeaveTime,
      canEarlyLeaveNow,
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

        {/* Day Type Toggle */}
        <Card className="bg-card shadow-md border-2 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {dayType === "full" ? (
                  <Sun className="w-5 h-5 text-primary" />
                ) : (
                  <Sunset className="w-5 h-5 text-accent" />
                )}
                <div>
                  <p className="font-semibold text-foreground">
                    {dayType === "full" ? "Full Day" : "Half Day"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Target: {dayType === "full" ? `${FULL_DAY_HOURS}h ${FULL_DAY_MINUTES}m` : `${HALF_DAY_HOURS}h ${HALF_DAY_MINUTES}m`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="day-type" className="text-sm text-muted-foreground">
                  {dayType === "full" ? "Full" : "Half"}
                </Label>
                <Switch
                  id="day-type"
                  checked={dayType === "half"}
                  onCheckedChange={(checked) => setDayType(checked ? "half" : "full")}
                />
              </div>
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
                      Target: {formatDuration(result.targetMinutes)}
                      {result.halfType && (
                        <span className="ml-2 text-accent">
                          ({result.halfType === "first" ? "First Half" : "Second Half"})
                        </span>
                      )}
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

            {/* Early Leave Section - Only for Full Day */}
            {dayType === "full" && (
              <Card className="bg-card shadow-md border-l-4 border-l-muted-foreground/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogOut className="w-5 h-5 text-muted-foreground" />
                    Leave Times
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Normal Leave */}
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Normal Leave (8:15 hrs)
                      </p>
                      {result.isComplete ? (
                        <p className="font-mono text-lg font-semibold text-success">
                          ✓ Complete
                        </p>
                      ) : result.completionTime ? (
                        <p className="font-mono text-lg font-semibold text-foreground">
                          {formatTime(result.completionTime)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Clock in to estimate</p>
                      )}
                      {!result.isComplete && (
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(result.remainingMinutes)} remaining
                        </p>
                      )}
                    </div>

                    {/* Early Leave */}
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Early Leave (7:00 hrs min)
                      </p>
                      {result.canEarlyLeaveNow ? (
                        <p className="font-mono text-lg font-semibold text-accent">
                          You can leave now
                        </p>
                      ) : result.earlyLeaveTime ? (
                        <p className="font-mono text-lg font-semibold text-foreground">
                          {formatTime(result.earlyLeaveTime)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Clock in to estimate</p>
                      )}
                      {!result.canEarlyLeaveNow && (
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(result.earlyLeaveRemainingMinutes)} remaining
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
