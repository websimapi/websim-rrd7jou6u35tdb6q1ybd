class AIPlayer {
  constructor(gameboy, options = {}) {
    this.gameboy = gameboy;
    this.isActive = false;
    this.interval = null;
    this.instructions = options.instructions || "Play the game intelligently.";
    this.captureInterval = options.captureInterval || 7000; // 7 seconds default
    this.conversationHistory = [];
    this.processingActions = false;
    
    // Enhanced cognitive architecture
    this.gameMemory = {
      // Game state tracking
      states: [],                // Screenshots with timestamps and metadata
      currentLocation: null,     // Current perceived location in game
      worldModel: {              // Spatial understanding of the game world
        knownLocations: {},      // Mapped locations with coordinates/descriptions
        connections: {},         // How locations connect to each other
        obstacles: {},           // Known obstacles and how to overcome them
        interactables: {}        // Objects that can be interacted with
      },
      
      // Goal and planning system
      goals: {
        current: null,           // Current primary goal
        subgoals: [],            // Ordered list of subgoals to achieve current goal
        completed: [],           // Successfully achieved goals
        failed: [],              // Failed goals with reason for failure
        pending: []              // Goals identified but not yet attempted
      },
      
      // Action and learning systems
      actions: {
        history: [],             // Chronological history of all actions
        effective: {},           // Actions that produced positive outcomes by context
        ineffective: {},         // Actions that produced negative outcomes by context
        pending: [],             // Actions queued for execution
        sequences: {},           // Effective sequences of actions by context
        stuckBreakers: []        // Special actions that have helped when stuck
      },
      
      // Knowledge representation
      gameKnowledge: {
        itemLocations: {},       // Where important items were found
        mechanics: {},           // Understood game mechanics
        triggers: {},            // Events that trigger game state changes
        enemyPatterns: {},       // Observed enemy behaviors
        puzzleSolutions: {}      // Solutions to encountered puzzles
      },
      
      // Pattern recognition
      patterns: {
        detected: {},            // Patterns detected in gameplay
        repeating: {},           // Repeatedly occurring patterns
        avoidance: {},           // Patterns to avoid (lead to failure)
        reinforcement: {}        // Patterns to reinforce (lead to success)
      },
      
      // Performance metrics
      metrics: {
        exploration: 0,          // How much of the game has been explored
        progress: 0,             // Overall progress toward game completion
        stuckCount: 0,           // Number of times gotten stuck
        recoveryRate: 0,         // How often successfully recovered from stuck states
        lastProgressTime: Date.now(),
        actionSuccessRate: {}    // Success rate of different action types
      }
    };
    
    // Configuration
    this.config = {
      maxStates: 20,             // Max number of full state snapshots to keep
      maxActions: 200,           // Max number of actions to remember
      maxConversationHistory: 8, // Max exchanges to keep in conversation history
      explorationRate: 0.3,      // Chance to try new actions instead of proven ones
      adaptiveExploration: true, // Adjust exploration rate based on success
      explorationDecay: 0.95,    // How quickly to reduce exploration after success
      stuckThreshold: 3,         // How many similar states before considered stuck
      patternLength: 5,          // Length of action sequences to consider patterns
      learningRate: 0.1,         // How quickly to adapt to new information
      maxLogEntries: 10,         // UI log display limit
      featureExtraction: true    // Extract features from screenshots for better comparison
    };
    
    // UI tracking
    this.uiState = {
      actionHistory: [],
      thoughtLog: [],
      currentAnalysis: "",
      lastScreenshot: null,
      statusMessages: []
    };
    
    // Initialize the planning system
    this.planner = {
      createPlan: this.createPlan.bind(this),
      executePlan: this.executePlan.bind(this),
      evaluatePlan: this.evaluatePlan.bind(this),
      adjustPlan: this.adjustPlan.bind(this)
    };
  }
  
  // Core AI functionality
  toggle(enable) {
    if (enable === undefined) {
      enable = !this.isActive;
    }
    
    if (enable && !this.isActive) {
      this.isActive = true;
      this.logAction("AI Player activated with instructions: " + this.instructions);
      this.startCapturing();
      this.updateLogDisplay();
    } else if (!enable && this.isActive) {
      this.isActive = false;
      this.logAction("AI Player deactivated");
      this.stopCapturing();
      this.updateLogDisplay();
    }
    
    return this.isActive;
  }
  
  startCapturing() {
    this.interval = setTimeout(this.capture.bind(this), this.captureInterval);
    console.log("AI Player activated");
  }
  
  stopCapturing() {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
    console.log("AI Player deactivated");
  }
  
  async capture() {
    if (!this.isActive || this.processingActions) {
      return;
    }
    
    try {
      this.logAction("Capturing game screen for analysis...");
      
      // Get the canvas and convert it to data URL
      const canvas = document.getElementById('canvas');
      const imageDataUrl = canvas.toDataURL('image/png');
      this.uiState.lastScreenshot = imageDataUrl;
      
      // Save the current state with enhanced metadata
      this.saveGameState(imageDataUrl);
      
      // Analyze the game state and make decisions
      await this.analyzeAndAct(imageDataUrl);
    } catch (error) {
      this.logAction("Error in AI capture process: " + error.message, "error");
      console.error("Error in AI capture process:", error);
    } finally {
      // Schedule the next capture if still active
      if (this.isActive) {
        this.interval = setTimeout(this.capture.bind(this), this.captureInterval);
      }
      this.updateLogDisplay();
    }
  }
  
  saveGameState(imageDataUrl) {
    // Create a rich game state snapshot with metadata
    const state = {
      timestamp: Date.now(),
      image: imageDataUrl,
      metrics: {...this.gameMemory.metrics},
      currentGoal: this.gameMemory.goals.current,
      activeSubgoals: [...this.gameMemory.goals.subgoals.slice(0, 3)],
      recentActions: this.gameMemory.actions.history.slice(0, 10),
      locationEstimate: this.gameMemory.currentLocation,
      featureHash: this.generateStateHash(imageDataUrl) // Create a unique signature of the state
    };
    
    // Add state to memory, maintaining max size
    this.gameMemory.states.unshift(state);
    if (this.gameMemory.states.length > this.config.maxStates) {
      this.gameMemory.states = this.gameMemory.states.slice(0, this.config.maxStates);
    }
    
    // Check for stuck state with enhanced detection
    this.detectStuckState();
    
    // Update the world model based on recent observations
    this.updateWorldModel(state);
    
    return state;
  }
  
  // Create a simple hash/signature of the screen to detect similar states
  generateStateHash(imageDataUrl) {
    // In a more advanced implementation, this could use actual image processing
    // For now, we'll just use a simple hash of the data URL
    let hash = 0;
    for (let i = 0; i < 100; i++) {
      const char = imageDataUrl.charCodeAt(Math.floor(imageDataUrl.length / 100 * i));
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  // Enhanced stuck detection 
  detectStuckState() {
    if (this.gameMemory.states.length < 3) return false;
    
    // Check if recent states are visually similar
    const currentStateHash = this.gameMemory.states[0].featureHash;
    let similarStateCount = 0;
    
    // Count similar recent states
    for (let i = 1; i < Math.min(this.gameMemory.states.length, 5); i++) {
      if (this.gameMemory.states[i].featureHash === currentStateHash) {
        similarStateCount++;
      }
    }
    
    // Check if we've performed diverse actions without state change
    const recentActionTypes = new Set();
    this.gameMemory.actions.history.slice(0, 10).forEach(action => {
      if (action.button) {
        recentActionTypes.add(action.button);
      }
    });
    
    // If we have enough similar states and diverse actions, we're stuck
    if (similarStateCount >= this.config.stuckThreshold - 1 && recentActionTypes.size >= 3) {
      this.gameMemory.metrics.stuckCount++;
      
      // Record the stuck state with context
      const stuckContext = {
        timestamp: Date.now(),
        stateHash: currentStateHash,
        recentActions: this.gameMemory.actions.history.slice(0, 10),
        currentGoal: this.gameMemory.goals.current,
        consecutiveSimilarStates: similarStateCount + 1
      };
      
      // Apply adaptive stuck-breaking strategy
      this.applyStuckBreakingStrategy(stuckContext);
      
      this.logAction("Stuck state detected. Applying recovery strategy.", "warning");
      return true;
    }
    
    return false;
  }
  
  // Apply an intelligent strategy to break out of stuck states
  applyStuckBreakingStrategy(stuckContext) {
    // Check if we have successful stuck-breaking actions from the past
    if (this.gameMemory.actions.stuckBreakers.length > 0) {
      // Try a previously successful stuck-breaker that we haven't tried recently
      const candidateActions = this.gameMemory.actions.stuckBreakers.filter(action => {
        return !this.gameMemory.actions.history.slice(0, 5).some(
          recent => recent.button === action.button
        );
      });
      
      if (candidateActions.length > 0) {
        // Queue up the most successful stuck-breaker
        const bestAction = candidateActions[0];
        this.gameMemory.actions.pending.push({
          button: bestAction.button,
          duration: bestAction.duration || 500,
          delay: 0,
          reason: "stuck_recovery",
          confidence: 0.9
        });
        return;
      }
    }
    
    // If no known stuck-breakers, dramatically increase exploration
    this.config.explorationRate = Math.min(0.9, this.config.explorationRate * 2);
    
    // Queue some exploratory actions
    // 1. Try a long press in a different direction
    const directions = ["UP", "RIGHT", "DOWN", "LEFT"];
    const recentDirections = new Set(
      this.gameMemory.actions.history
        .slice(0, 5)
        .filter(a => directions.includes(a.button))
        .map(a => a.button)
    );
    
    const unusedDirections = directions.filter(dir => !recentDirections.has(dir));
    
    if (unusedDirections.length > 0) {
      // Try a direction we haven't tried recently
      this.gameMemory.actions.pending.push({
        button: unusedDirections[0],
        duration: 1000, // Long press
        delay: 0,
        reason: "exploration",
        confidence: 0.7
      });
      
      // Follow it with an A press
      this.gameMemory.actions.pending.push({
        button: "A",
        duration: 100,
        delay: 100,
        reason: "exploration",
        confidence: 0.6
      });
    } else {
      // If we've tried all directions, do a complex sequence
      this.gameMemory.actions.pending.push(
        { button: "START", duration: 100, delay: 0, reason: "stuck_recovery", confidence: 0.5 },
        { button: "A", duration: 100, delay: 300, reason: "stuck_recovery", confidence: 0.5 },
        { button: "B", duration: 100, delay: 300, reason: "stuck_recovery", confidence: 0.5 }
      );
    }
  }
  
  // Update our understanding of the game world based on observations
  updateWorldModel(state) {
    // Extract location information if possible
    if (this.gameMemory.currentLocation) {
      // If we have a current location, check if we've moved
      const previousState = this.gameMemory.states[1];
      if (previousState && previousState.featureHash !== state.featureHash) {
        // State changed, we may have moved or triggered something
        
        // Record the connection between locations
        if (!this.gameMemory.worldModel.connections[previousState.locationEstimate]) {
          this.gameMemory.worldModel.connections[previousState.locationEstimate] = {};
        }
        
        // Find what action caused the transition
        const transitionAction = this.gameMemory.actions.history[0]; // Most recent action
        if (transitionAction && transitionAction.button) {
          // Record that this action led from previous location to current
          this.gameMemory.worldModel.connections[previousState.locationEstimate][state.locationEstimate] = {
            action: transitionAction.button,
            count: 1,
            success: true
          };
        }
      }
    }
    
    // Update exploration metric based on unique states seen
    const uniqueStates = new Set(this.gameMemory.states.map(s => s.featureHash)).size;
    this.gameMemory.metrics.exploration = Math.min(100, uniqueStates);
  }
  
  // Enhanced pattern detection with sequence learning
  detectPatterns() {
    // We need enough actions to find meaningful patterns
    if (this.gameMemory.actions.history.length < this.config.patternLength * 2) return;
    
    // Look at recent actions
    const recentActions = this.gameMemory.actions.history.slice(0, 30);
    
    // Find sequences of different lengths
    for (let seqLength = 3; seqLength <= this.config.patternLength; seqLength++) {
      const sequences = {};
      
      // Scan for repeating sequences
      for (let i = 0; i <= recentActions.length - seqLength; i++) {
        // Create a signature for this sequence
        const seq = recentActions.slice(i, i + seqLength)
          .filter(a => a.button) // Only include button actions
          .map(a => a.button).join(',');
        
        if (seq.length > 0) {
          sequences[seq] = (sequences[seq] || 0) + 1;
          
          // If we find a repeated pattern
          if (sequences[seq] >= 3) {
            const pattern = {
              sequence: seq.split(','),
              count: sequences[seq],
              lastDetected: Date.now()
            };
            
            // Determine if this pattern is associated with progress or being stuck
            const isStuckPattern = this.gameMemory.metrics.stuckCount > 
              this.gameMemory.actions.history.length / 100;
            
            if (isStuckPattern) {
              // This pattern may be contributing to being stuck
              this.gameMemory.patterns.avoidance[seq] = pattern;
              this.logAction("Detected potentially harmful pattern: " + seq, "warning");
            } else {
              // This might be a useful pattern
              this.gameMemory.patterns.detected[seq] = pattern;
              
              // If we've made progress with this pattern, reinforce it
              if (this.hasRecentlyMadeProgress()) {
                this.gameMemory.patterns.reinforcement[seq] = pattern;
                this.logAction("Reinforcing successful pattern: " + seq, "info");
              }
            }
          }
        }
      }
    }
  }
  
  hasRecentlyMadeProgress() {
    // Check if we've made progress recently (last 30 seconds)
    return Date.now() - this.gameMemory.metrics.lastProgressTime < 30000;
  }
  
  // Planning system
  createPlan() {
    // If we have no current goal, create one
    if (!this.gameMemory.goals.current) {
      this.gameMemory.goals.current = {
        type: "exploration",
        description: "Explore the game world and identify objectives",
        createdAt: Date.now(),
        status: "active"
      };
    }
    
    // Based on the current goal, create a plan of action
    const plan = {
      goal: this.gameMemory.goals.current,
      steps: [],
      createdAt: Date.now(),
      estimatedSteps: 5,
      confidence: 0.7
    };
    
    // If we're stuck, prioritize unsticking
    if (this.gameMemory.metrics.stuckCount > 0 && 
        Date.now() - this.gameMemory.metrics.lastProgressTime > 20000) {
      plan.steps.push({
        type: "unstick",
        description: "Try to break out of stuck state",
        actions: this.generateUnstickActions()
      });
    }
    
    // Add steps based on current goal
    switch (this.gameMemory.goals.current.type) {
      case "exploration":
        plan.steps.push({
          type: "explore",
          description: "Navigate in a new direction",
          actions: this.generateExplorationActions()
        });
        break;
        
      case "reach_location":
        if (this.gameMemory.worldModel.knownLocations[this.gameMemory.goals.current.target]) {
          plan.steps.push({
            type: "navigate",
            description: `Navigate to ${this.gameMemory.goals.current.target}`,
            actions: this.generateNavigationActions(this.gameMemory.goals.current.target)
          });
        }
        break;
        
      case "interact":
        plan.steps.push({
          type: "interact",
          description: `Interact with ${this.gameMemory.goals.current.object}`,
          actions: this.generateInteractionActions(this.gameMemory.goals.current.object)
        });
        break;
        
      default:
        // Default to exploration
        plan.steps.push({
          type: "explore",
          description: "Navigate and observe",
          actions: this.generateExplorationActions()
        });
    }
    
    return plan;
  }
  
  generateExplorationActions() {
    // Generate actions that encourage exploration
    const actions = [];
    
    // Choose a direction we haven't tried recently
    const directions = ["UP", "RIGHT", "DOWN", "LEFT"];
    const recentDirections = new Set(
      this.gameMemory.actions.history
        .slice(0, 5)
        .filter(a => directions.includes(a.button))
        .map(a => a.button)
    );
    
    // Prefer directions we haven't tried
    const candidateDirections = directions.filter(d => !recentDirections.has(d));
    const direction = candidateDirections.length > 0 ? 
      candidateDirections[Math.floor(Math.random() * candidateDirections.length)] : 
      directions[Math.floor(Math.random() * directions.length)];
    
    // Add direction press
    actions.push({
      button: direction,
      duration: 500,
      delay: 0,
      reason: "exploration"
    });
    
    // Add interaction button press
    if (Math.random() > 0.5) {
      actions.push({
        button: "A",
        duration: 100,
        delay: 600,
        reason: "exploration"
      });
    }
    
    return actions;
  }
  
  generateUnstickActions() {
    // Actions specifically designed to break out of stuck states
    const actions = [];
    
    // Try pressing START to access menu or pause, then B to cancel
    actions.push(
      { button: "START", duration: 100, delay: 0, reason: "unstick" },
      { button: "B", duration: 100, delay: 300, reason: "unstick" }
    );
    
    // Try a sequence of different directions
    actions.push(
      { button: "UP", duration: 300, delay: 100, reason: "unstick" },
      { button: "RIGHT", duration: 300, delay: 0, reason: "unstick" },
      { button: "DOWN", duration: 300, delay: 0, reason: "unstick" },
      { button: "LEFT", duration: 300, delay: 0, reason: "unstick" }
    );
    
    // Try combination of A + direction
    actions.push(
      { button: "A", duration: 100, delay: 100, reason: "unstick" },
      { button: "RIGHT", duration: 300, delay: 0, reason: "unstick" }
    );
    
    return actions;
  }
  
  generateNavigationActions(targetLocation) {
    // Given a target location, generate actions to navigate there
    // This would use the world model to find a path
    return this.generateExplorationActions(); // Placeholder until we have a more complete world model
  }
  
  generateInteractionActions(object) {
    // Actions to interact with a specific object
    const actions = [];
    
    // Face the object (if we know which direction it is)
    if (this.gameMemory.gameKnowledge.itemLocations[object]) {
      actions.push({
        button: this.gameMemory.gameKnowledge.itemLocations[object].direction,
        duration: 100,
        delay: 0,
        reason: "interaction"
      });
    }
    
    // Try interaction buttons
    actions.push(
      { button: "A", duration: 100, delay: 100, reason: "interaction" }
    );
    
    return actions;
  }
  
  executePlan(plan) {
    // Queue up all actions from the plan
    plan.steps.forEach(step => {
      step.actions.forEach(action => {
        this.gameMemory.actions.pending.push(action);
      });
    });
    
    // Record the plan execution
    this.gameMemory.goals.current.lastPlan = {
      executedAt: Date.now(),
      plan: plan
    };
    
    return true;
  }
  
  evaluatePlan(plan, outcomes) {
    // Evaluate how well the plan worked
    let success = false;
    
    // Check if state changed
    if (this.gameMemory.states.length >= 2) {
      const beforeState = this.gameMemory.states[1].featureHash;
      const afterState = this.gameMemory.states[0].featureHash;
      success = beforeState !== afterState;
    }
    
    // Update the goal status
    if (success) {
      this.gameMemory.goals.current.progress = 
        (this.gameMemory.goals.current.progress || 0) + 1;
      
      // Record time of progress
      this.gameMemory.metrics.lastProgressTime = Date.now();
      
      // If we've made enough progress, consider the goal complete
      if (this.gameMemory.goals.current.progress >= 5) {
        this.gameMemory.goals.current.status = "completed";
        this.gameMemory.goals.completed.push(this.gameMemory.goals.current);
        this.gameMemory.goals.current = null;
      }
    }
    
    return success;
  }
  
  adjustPlan(plan, success) {
    // Adjust exploration rate based on success
    if (this.config.adaptiveExploration) {
      if (success) {
        // If successful, reduce exploration (focus on what works)
        this.config.explorationRate *= this.config.explorationDecay;
      } else {
        // If unsuccessful, increase exploration
        this.config.explorationRate = Math.min(0.9, this.config.explorationRate * 1.5);
      }
    }
    
    return true;
  }
  
  async analyzeAndAct(imageDataUrl) {
    this.processingActions = true;
    this.logAction("Analyzing game state with enhanced cognitive model...");
    this.updateLogDisplay();
    
    try {
      // Detect patterns in previous actions
      this.detectPatterns();
      
      // Prepare context with enhanced game history and cognitive model
      const historyContext = this.prepareHistoryContext();
      
      // Use the LLM to analyze the current state
      const completion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an advanced AI that plays GameBoy games strategically. You have a cognitive architecture that helps you understand and master games.
            
Your task is to play the game based on the following instructions: ${this.instructions}

${historyContext}

First, analyze the screenshot and describe what you see in the game.
Then use your cognitive architecture to make decisions:
1. Update your mental model of the game world
2. Set or refine goals based on what you observe
3. Create a plan to achieve those goals
4. Generate actions to execute the plan

Respond with a JSON object that contains:
1. A "thoughts" field with your analysis of the current game state
2. A "modelUpdates" field describing what you've learned about the game world
3. A "goals" field outlining your current objectives
4. A "strategy" field explaining your approach
5. An "actions" array of precise actions to take

Each action should include: 
- button: The button to press (A, B, UP, DOWN, LEFT, RIGHT, START, SELECT)
- duration: How long to hold it in milliseconds
- delay: How long to wait before this action in milliseconds`,
          },
          ...this.conversationHistory,
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Here is the current state of the game. Use your cognitive architecture to make strategic decisions.",
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              }
            ],
          },
        ],
        json: true
      });
      
      // Process the AI's response
      try {
        const response = JSON.parse(completion.content);
        
        // Save the thought process with enhanced cognitive details
        if (response.thoughts) {
          this.uiState.currentAnalysis = response.thoughts;
          this.uiState.thoughtLog.unshift({
            timestamp: new Date().toISOString(),
            thoughts: response.thoughts
          });
          
          // Trim thought log if too long
          if (this.uiState.thoughtLog.length > this.config.maxLogEntries) {
            this.uiState.thoughtLog = this.uiState.thoughtLog.slice(0, this.config.maxLogEntries);
          }
          
          this.logAction("AI Analysis: " + response.thoughts.substring(0, 100) + "...");
        }
        
        // Update mental model with AI insights
        if (response.modelUpdates) {
          this.logAction("Updating world model: " + response.modelUpdates.substring(0, 100) + "...");
          
          // Parse and store any structured knowledge about the game
          if (typeof response.modelUpdates === 'object') {
            // Merge the model updates with our world model
            Object.assign(this.gameMemory.worldModel, response.modelUpdates);
          }
        }
        
        // Update goals based on AI recommendations
        if (response.goals) {
          this.logAction("Setting goals: " + (typeof response.goals === 'string' ? 
            response.goals : JSON.stringify(response.goals).substring(0, 100) + "..."));
          
          // Update the current goal if provided
          if (response.goals.current) {
            this.gameMemory.goals.current = response.goals.current;
          }
          
          // Update subgoals if provided
          if (response.goals.subgoals) {
            this.gameMemory.goals.subgoals = response.goals.subgoals;
          }
        }
        
        // Save the strategy for future reference
        if (response.strategy) {
          this.logAction("Strategy: " + response.strategy.substring(0, 100) + "...");
        }
        
        // Save this exchange to the conversation history
        this.conversationHistory.push({
          role: "user",
          content: "Here is the current state of the game. What should I do next?",
        });
        
        this.conversationHistory.push({
          role: "assistant",
          content: completion.content,
        });
        
        // Limit conversation history to prevent token overuse
        if (this.conversationHistory.length > this.config.maxConversationHistory) {
          this.conversationHistory = this.conversationHistory.slice(-this.config.maxConversationHistory);
        }
        
        // Process the actions with the enhanced action system
        if (response.actions && response.actions.length > 0) {
          this.logAction(`Planning to execute ${response.actions.length} strategic actions`);
          
          // Add contextual metadata to actions
          const enhancedActions = response.actions.map(action => ({
            ...action,
            source: "ai_planning",
            confidence: 0.8,
            timestamp: Date.now()
          }));
          
          // Execute the actions
          await this.processActions(enhancedActions);
          
          // Record a summary in our metrics
          this.gameMemory.metrics.actionCount = 
            (this.gameMemory.metrics.actionCount || 0) + response.actions.length;
          
          // After executing actions, check for patterns
          this.detectPatterns();
        } else {
          this.logAction("No actions to take at this time - analyzing game state");
        }
      } catch (e) {
        this.logAction("Error processing AI response: " + e.message, "error");
        console.error("Error processing AI response:", e);
        console.log("Raw response:", completion.content);
        
        // Fall back to a basic exploration strategy
        const fallbackActions = this.generateExplorationActions();
        await this.processActions(fallbackActions);
      }
    } catch (error) {
      this.logAction("Error in analysis phase: " + error.message, "error");
      console.error("Error calling LLM:", error);
      
      // Still try to execute a basic strategy
      const emergencyActions = this.generateUnstickActions();
      await this.processActions(emergencyActions);
    } finally {
      this.processingActions = false;
      this.updateLogDisplay();
    }
  }
  
  prepareHistoryContext() {
    // Create a comprehensive context with the cognitive architecture state
    let context = `## Game Knowledge\n`;
    
    // Add current goals
    context += `### Current Goals:\n`;
    if (this.gameMemory.goals.current) {
      context += `- Primary Goal: ${this.gameMemory.goals.current.description || this.gameMemory.goals.current.type}\n`;
    } else {
      context += `- No primary goal set yet\n`;
    }
    
    if (this.gameMemory.goals.subgoals && this.gameMemory.goals.subgoals.length > 0) {
      context += `- Subgoals:\n`;
      this.gameMemory.goals.subgoals.slice(0, 3).forEach(goal => {
        context += `  - ${goal.description || goal.type}\n`;
      });
    }
    
    // Add exploration status
    context += `\n### Exploration Status:\n`;
    context += `- Explored approximately ${this.gameMemory.metrics.exploration}% of the game\n`;
    context += `- Discovered ${Object.keys(this.gameMemory.worldModel.knownLocations).length} distinct locations\n`;
    
    // Add metrics
    context += `\n### Performance Metrics:\n`;
    context += `- Total actions: ${this.gameMemory.metrics.actionCount || 0}\n`;
    context += `- Stuck count: ${this.gameMemory.metrics.stuckCount || 0}\n`;
    context += `- Time since last progress: ${Math.floor((Date.now() - this.gameMemory.metrics.lastProgressTime) / 1000)} seconds\n`;
    
    // Add detected patterns
    if (Object.keys(this.gameMemory.patterns.detected).length > 0) {
      context += `\n### Detected Patterns:\n`;
      for (const [pattern, data] of Object.entries(this.gameMemory.patterns.detected)) {
        context += `- Pattern [${pattern}] observed ${data.count} times\n`;
      }
    }
    
    // Add successful strategies
    if (Object.keys(this.gameMemory.patterns.reinforcement).length > 0) {
      context += `\n### Successful Strategies:\n`;
      for (const [pattern, data] of Object.entries(this.gameMemory.patterns.reinforcement)) {
        context += `- Strategy [${pattern}] has been effective\n`;
      }
    }
    
    // Add warning if stuck
    if (this.gameMemory.metrics.stuckCount > 2) {
      context += `\n### Warning: Repeated stuck states detected. Consider these strategies:\n`;
      context += `- Try a completely different approach\n`;
      context += `- Look for interactive elements you haven't engaged with\n`;
      context += `- Consider whether you need to solve a puzzle or find an item\n`;
    }
    
    // Recent actions history
    if (this.gameMemory.actions.history.length > 0) {
      context += `\n### Recent Actions:\n`;
      const recentActions = this.gameMemory.actions.history.slice(0, 10);
      recentActions.forEach(action => {
        if (action.button) {
          context += `- Pressed ${action.button} for ${action.duration || 100}ms\n`;
        }
      });
    }
    
    return context;
  }
  
  async processActions(actions) {
    if (!actions || !actions.length) {
      console.log("No actions to process");
      return;
    }
    
    console.log("Processing strategic actions:", actions);
    
    for (const action of actions) {
      // Add to game memory with enhanced metadata
      const actionWithMeta = {
        ...action,
        timestamp: Date.now(),
        stateBeforeHash: this.gameMemory.states[0]?.featureHash,
        goalContext: this.gameMemory.goals.current?.type
      };
      
      this.gameMemory.actions.history.unshift(actionWithMeta);
      if (this.gameMemory.actions.history.length > this.config.maxActions) {
        this.gameMemory.actions.history = this.gameMemory.actions.history.slice(0, this.config.maxActions);
      }
      
      // Log the action with context
      this.logAction(`Executing: ${action.button} (duration: ${action.duration || 100}ms, delay: ${action.delay || 0}ms, reason: ${action.reason || 'planning'})`);
      this.updateLogDisplay();
      
      // Wait for any delay
      if (action.delay && action.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }
      
      // Press the button
      this.pressButton(action.button, true);
      
      // Add to UI action history
      this.uiState.actionHistory.unshift({
        timestamp: new Date().toISOString(),
        button: action.button,
        duration: action.duration || 100,
        delay: action.delay || 0,
        reason: action.reason || 'execute'
      });
      
      // Trim action history if too long
      if (this.uiState.actionHistory.length > this.config.maxLogEntries * 3) {
        this.uiState.actionHistory = this.uiState.actionHistory.slice(0, this.config.maxLogEntries * 3);
      }
      
      // Hold for duration
      if (action.duration && action.duration > 0) {
        await new Promise(resolve => setTimeout(resolve, action.duration));
      } else {
        // Default press duration
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Release the button
      this.pressButton(action.button, false);
      
      // For longer button sequences, add a small pause between actions
      if (actions.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // After completing actions, check if they resolved a stuck state
    if (this.gameMemory.metrics.stuckCount > 0) {
      // Capture a new screenshot to see if state changed
      const canvas = document.getElementById('canvas');
      const newImageDataUrl = canvas.toDataURL('image/png');
      const newStateHash = this.generateStateHash(newImageDataUrl);
      
      // If the state changed after our actions
      if (newStateHash !== this.gameMemory.states[0].featureHash) {
        // Record which actions helped break the stuck state
        actions.forEach(action => {
          this.gameMemory.actions.stuckBreakers.push({
            button: action.button,
            duration: action.duration,
            successCount: 1,
            lastSuccess: Date.now()
          });
        });
        
        // Update metrics
        this.gameMemory.metrics.lastProgressTime = Date.now();
        this.logAction("Successfully broke out of stuck state!", "success");
      }
    }
  }
  
  pressButton(button, isPressed) {
    // This function will trigger the input via the existing input system
    if (isPressed) {
      this.gameboy.input.pressKey(button);
    } else {
      this.gameboy.input.releaseKey(button);
    }
    
    console.log(`Button ${button} ${isPressed ? 'pressed' : 'released'}`);
  }
  
  setInstructions(instructions) {
    this.instructions = instructions;
    // Reset conversation history when instructions change
    this.conversationHistory = [];
    this.logAction("AI instructions updated: " + instructions);
    this.updateLogDisplay();
    console.log("AI instructions updated:", instructions);
  }
  
  logAction(message, type = "info") {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: message,
      type: type
    };
    
    this.uiState.actionHistory.unshift(logEntry);
    this.uiState.statusMessages.unshift(logEntry);
    
    // Trim logs if they get too large
    if (this.uiState.actionHistory.length > this.config.maxLogEntries * 3) {
      this.uiState.actionHistory = this.uiState.actionHistory.slice(0, this.config.maxLogEntries * 3);
    }
    
    if (this.uiState.statusMessages.length > this.config.maxLogEntries * 2) {
      this.uiState.statusMessages = this.uiState.statusMessages.slice(0, this.config.maxLogEntries * 2);
    }
    
    console.log(`[AI Player] ${message}`);
  }
  
  updateLogDisplay() {
    const logContainer = document.getElementById('ai-log-container');
    if (!logContainer) return;
    
    let logHTML = '<div class="ai-log-content">';
    
    // Add current analysis
    if (this.uiState.currentAnalysis) {
      logHTML += `<div class="ai-analysis">
        <h4>Current Analysis:</h4>
        <p>${this.uiState.currentAnalysis}</p>
      </div>`;
    }
    
    // Add current goals section
    if (this.gameMemory.goals.current) {
      logHTML += `<div class="ai-goals">
        <h4>Current Goals:</h4>
        <p><strong>Primary:</strong> ${this.gameMemory.goals.current.description || this.gameMemory.goals.current.type}</p>`;
      
      if (this.gameMemory.goals.subgoals && this.gameMemory.goals.subgoals.length > 0) {
        logHTML += `<p><strong>Subgoals:</strong></p><ul>`;
        this.gameMemory.goals.subgoals.slice(0, 3).forEach(goal => {
          logHTML += `<li>${goal.description || goal.type}</li>`;
        });
        logHTML += `</ul>`;
      }
      
      logHTML += `</div>`;
    }
    
    // Add pattern detection section
    if (Object.keys(this.gameMemory.patterns.detected).length > 0) {
      logHTML += `<div class="ai-patterns">
        <h4>Detected Patterns:</h4>
        <ul>`;
      
      for (const [pattern, data] of Object.entries(this.gameMemory.patterns.detected)) {
        logHTML += `<li>Pattern: ${pattern} (${data.count} times)</li>`;
      }
      
      logHTML += `</ul>
      </div>`;
    }
    
    // Add metrics section
    logHTML += `<div class="ai-metrics">
      <h4>Performance:</h4>
      <ul>
        <li>Total actions: ${this.gameMemory.metrics.actionCount || 0}</li>
        <li>Stuck count: ${this.gameMemory.metrics.stuckCount || 0}</li>
        <li>Exploration: ${this.gameMemory.metrics.exploration || 0}%</li>
        <li>Time since progress: ${Math.floor((Date.now() - this.gameMemory.metrics.lastProgressTime) / 1000)}s</li>
      </ul>
    </div>`;
    
    // Add action history
    logHTML += '<div class="ai-history"><h4>Recent Actions:</h4><ul>';
    for (let i = 0; i < Math.min(this.uiState.actionHistory.length, this.config.maxLogEntries); i++) {
      const log = this.uiState.actionHistory[i];
      const time = new Date(log.timestamp).toLocaleTimeString();
      const className = log.type === "error" ? "log-error" : 
                       log.type === "warning" ? "log-warning" : 
                       log.type === "success" ? "log-success" : "log-info";
      
      logHTML += `<li class="${className}"><span class="log-time">[${time}]</span> ${log.message}</li>`;
    }
    logHTML += '</ul></div>';
    
    logHTML += '</div>';
    
    logContainer.innerHTML = logHTML;
  }
}