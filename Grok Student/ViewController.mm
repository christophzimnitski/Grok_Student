//
//  ViewController.mm
//  Grok Student
//

#import "ViewController.h"
#import "KeychainHelper.h"
#import "GrokServer.h"
#import "AppDelegate.h"
#import <AVFoundation/AVFoundation.h>

@interface ViewController ()

@property (nonatomic, readwrite, strong) UITextField *apiKeyField;
@property (nonatomic, readwrite, strong) UIButton *saveButton;
@property (nonatomic, readwrite, strong) GrokServer *grokServer;
@property (nonatomic, readwrite, assign) NSInteger addressRetryCount;
@property (nonatomic, readwrite, strong) AVAudioPlayer *silentPlayer;
@property (nonatomic, readwrite, strong) NSString *selectedAPI; // @"groq" or @"gemini"
@property (nonatomic, readwrite, strong) UISegmentedControl *apiSelector;

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    self.view.backgroundColor = [UIColor systemBackgroundColor];
    
    NSString *savedGroqKey = [KeychainHelper getAPIKeyForAPI:@"groq"];
    NSString *savedGeminiKey = [KeychainHelper getAPIKeyForAPI:@"gemini"];
    
    if (savedGroqKey.length > 0 || savedGeminiKey.length > 0) {
        self.selectedAPI = [[NSUserDefaults standardUserDefaults] stringForKey:@"selectedAPI"];
        if (!self.selectedAPI) {
            self.selectedAPI = savedGroqKey.length > 0 ? @"groq" : @"gemini";
        }
        [self showServerReadyUI];
    } else {
        self.selectedAPI = @"groq";
        [self showKeyInputUI];
    }
}

- (void)startSilentAudioForBackground {
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback
                                           mode:AVAudioSessionModeDefault
                                        options:AVAudioSessionCategoryOptionMixWithOthers
                                          error:nil];
    
    [[AVAudioSession sharedInstance] setActive:YES error:nil];

    NSString *path = [[NSBundle mainBundle] pathForResource:@"silent" ofType:@"m4a"];
    if (!path) {
        NSLog(@"Silent audio file missing!");
        return;
    }

    NSURL *url = [NSURL fileURLWithPath:path];
    NSError *error = nil;
    self.silentPlayer = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
    if (error) {
        NSLog(@"Audio player error: %@", error);
        return;
    }

    self.silentPlayer.numberOfLoops = -1;
    self.silentPlayer.volume = 0.0;
    [self.silentPlayer prepareToPlay];
    [self.silentPlayer play];

    NSLog(@"Silent background audio loop started → extended background execution");
}

- (void)stopSilentAudio {
    [self.silentPlayer stop];
    self.silentPlayer = nil;
    
    [[AVAudioSession sharedInstance] setActive:NO error:nil];
    NSLog(@"Silent audio stopped");
}

- (void)showServerReadyUI {
    [self clearAllSubviews];
    
    UILabel *status = [[UILabel alloc] init];
    status.text = @"✓ API Key loaded\nServer running — connect from your computer!";
    status.numberOfLines = 0;
    status.textAlignment = NSTextAlignmentCenter;
    status.font = [UIFont preferredFontForTextStyle:UIFontTextStyleTitle2];
    status.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:status];
    
    UIButton *changeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [changeButton setTitle:@"Change API Key" forState:UIControlStateNormal];
    [changeButton addTarget:self action:@selector(resetAndShowInput) forControlEvents:UIControlEventTouchUpInside];
    changeButton.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:changeButton];
    
    self.apiSelector = [[UISegmentedControl alloc] initWithItems:@[@"Groq", @"Gemini"]];
    self.apiSelector.selectedSegmentIndex = [self.selectedAPI isEqualToString:@"groq"] ? 0 : 1;
    [self.apiSelector addTarget:self action:@selector(apiChanged:) forControlEvents:UIControlEventValueChanged];
    self.apiSelector.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.apiSelector];
    
    self.ipLabel = [[UILabel alloc] init];
    self.ipLabel.font = [UIFont systemFontOfSize:13];
    self.ipLabel.textColor = [UIColor secondaryLabelColor];
    self.ipLabel.textAlignment = NSTextAlignmentCenter;
    self.ipLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.ipLabel];
    
    if (!self.grokServer) {
        AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
        self.grokServer = appDelegate.grokServer;
    }
    
    self.grokServer.selectedAPI = self.selectedAPI;

    if (self.grokServer && self.grokServer.port == 0) {
        BOOL started = [self.grokServer startServer];
        if (!started) {
            NSLog(@"Failed to start GrokServer from ViewController; check that the 'Web' folder exists in the app bundle.");
        }
    }

    self.addressRetryCount = 0;
    [self updateServerAddressLabel];
    
    // Layout
    [NSLayoutConstraint activateConstraints:@[
        [status.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        [status.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor constant:-80],
        [status.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.view.leadingAnchor constant:20],
        [status.trailingAnchor constraintLessThanOrEqualToAnchor:self.view.trailingAnchor constant:-20],
        
        [changeButton.topAnchor constraintEqualToAnchor:status.bottomAnchor constant:50],
        [changeButton.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        
        [self.apiSelector.topAnchor constraintEqualToAnchor:changeButton.bottomAnchor constant:20],
        [self.apiSelector.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        
        [self.ipLabel.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20],
        [self.ipLabel.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.view.leadingAnchor constant:20],
        [self.ipLabel.trailingAnchor constraintLessThanOrEqualToAnchor:self.view.trailingAnchor constant:-20],
        [self.ipLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor]
    ]];
    
    [self startSilentAudioForBackground];
}

- (void)showKeyInputUI {
    [self clearAllSubviews];
    
    UILabel *title = [[UILabel alloc] init];
    title.text = @"Grok Student Setup";
    title.font = [UIFont preferredFontForTextStyle:UIFontTextStyleTitle1];
    title.textAlignment = NSTextAlignmentCenter;
    title.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:title];
    
    UILabel *label = [[UILabel alloc] init];
    label.text = [NSString stringWithFormat:@"Enter your %@ API key:", self.selectedAPI.capitalizedString];
    label.numberOfLines = 0;
    label.textAlignment = NSTextAlignmentCenter;
    label.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:label];
    
    self.apiKeyField = [[UITextField alloc] init];
    self.apiKeyField.borderStyle = UITextBorderStyleRoundedRect;
    self.apiKeyField.placeholder = @"Paste your API key here";
    self.apiKeyField.secureTextEntry = YES;
    self.apiKeyField.font = [UIFont systemFontOfSize:16];
    self.apiKeyField.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.apiKeyField];
    
    self.saveButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [self.saveButton setTitle:@"Save Key & Start Server" forState:UIControlStateNormal];
    self.saveButton.titleLabel.font = [UIFont boldSystemFontOfSize:18];
    [self.saveButton addTarget:self action:@selector(saveKey) forControlEvents:UIControlEventTouchUpInside];
    self.saveButton.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.saveButton];
    
    [NSLayoutConstraint activateConstraints:@[
        [title.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:60],
        [title.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.view.leadingAnchor constant:20],
        [title.trailingAnchor constraintLessThanOrEqualToAnchor:self.view.trailingAnchor constant:-20],
        [title.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        
        [label.topAnchor constraintEqualToAnchor:title.bottomAnchor constant:40],
        [label.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:40],
        [label.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-40],
        
        [self.apiKeyField.topAnchor constraintEqualToAnchor:label.bottomAnchor constant:30],
        [self.apiKeyField.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:40],
        [self.apiKeyField.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-40],
        [self.apiKeyField.heightAnchor constraintEqualToConstant:50],
        
        [self.saveButton.topAnchor constraintEqualToAnchor:self.apiKeyField.bottomAnchor constant:40],
        [self.saveButton.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        [self.saveButton.widthAnchor constraintEqualToConstant:280],
        [self.saveButton.heightAnchor constraintEqualToConstant:60]
    ]];
}

- (void)clearAllSubviews {
    for (UIView *view in self.view.subviews) {
        [view removeFromSuperview];
    }
}

- (void)saveKey {
    NSString *key = [self.apiKeyField.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    
    if (key.length == 0) {
        [self showAlert:@"Error" message:@"Please enter a valid API key."];
        return;
    }
    
    if ([KeychainHelper saveAPIKey:key forAPI:self.selectedAPI]) {
        [[NSUserDefaults standardUserDefaults] setObject:self.selectedAPI forKey:@"selectedAPI"];
        [[NSUserDefaults standardUserDefaults] synchronize];
        
        AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
        self.grokServer = appDelegate.grokServer;
        self.grokServer.selectedAPI = self.selectedAPI;
        BOOL started = YES;
        if (self.grokServer && self.grokServer.port == 0) {
            started = [self.grokServer startServer];
        }
        
        if (started) {
            [self showServerReadyUI];
        } else {
            [self showAlert:@"Server Error" message:@"Failed to start server. Check console logs."];
        }
    } else {
        [self showAlert:@"Error" message:@"Could not save key to Keychain."];
    }
}

- (void)resetAndShowInput {
    [self stopSilentAudio];
    [KeychainHelper deleteAPIKeyForAPI:self.selectedAPI];
    if (self.grokServer) {
        [self.grokServer stopServer];
    }
    self.grokServer = nil;
    [self showKeyInputUI];
}

- (void)apiChanged:(UISegmentedControl *)sender {
    NSString *newAPI = sender.selectedSegmentIndex == 0 ? @"groq" : @"gemini";
    NSString *key = [KeychainHelper getAPIKeyForAPI:newAPI];
    
    if (!key || key.length == 0) {
        self.selectedAPI = newAPI;
        [self showKeyInputUI];
    } else {
        self.selectedAPI = newAPI;
        [[NSUserDefaults standardUserDefaults] setObject:newAPI forKey:@"selectedAPI"];
        [[NSUserDefaults standardUserDefaults] synchronize];
        self.grokServer.selectedAPI = newAPI;
        // API change takes effect on next request; no server restart needed
    }
}

- (void)showAlert:(NSString *)title message:(NSString *)message {
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:title
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
    [self presentViewController:alert animated:YES completion:nil];
}

- (void)updateServerAddressLabel {
    NSURL *serverURL = self.grokServer.webServer.serverURL;
    NSString *currentIP = [self.grokServer localIPAddress];
    NSLog(@"Direct method call returns: %@", currentIP);
    NSString *fullURL;
    NSInteger port = (self.grokServer.port == 0 ? 8080 : self.grokServer.port);
    if (serverURL) {
        NSURLComponents *components = [NSURLComponents componentsWithURL:serverURL resolvingAgainstBaseURL:NO];
        if (components.port == nil || components.port.integerValue == 0) {
            components.port = @(port);
            fullURL = components.URL.absoluteString;
        } else {
            fullURL = serverURL.absoluteString;
        }
    } else {
        fullURL = [NSString stringWithFormat:@"http://%@:%ld/", currentIP ?: @"localhost", (long)port];
    }
    self.ipLabel.text = [NSString stringWithFormat:@"Server address: %@", fullURL];
    if ((!serverURL || self.grokServer.port == 0) && self.addressRetryCount < 4) {
        self.addressRetryCount += 1;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [self updateServerAddressLabel];
        });
    }
}

@end

