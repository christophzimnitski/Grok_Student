//
//  ViewController.mm
//  Grok Student
//
//  Updated for free API (Gemini/Groq) + proper server start
//

#import "ViewController.h"
#import "KeychainHelper.h"
#import "GrokServer.h"          // Import your server class
#import <Masonry/Masonry.h>     // Optional: use Masonry for easy constraints (via CocoaPods)

@interface ViewController ()

@property (nonatomic, strong) UITextField *apiKeyField;
@property (nonatomic, strong) UIButton *saveButton;
@property (nonatomic, strong) GrokServer *grokServer;  // Retain server instance

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    self.view.backgroundColor = [UIColor systemBackgroundColor];
    
    NSString *savedKey = [KeychainHelper getAPIKey];
    if (savedKey && savedKey.length > 0) {
        [self showServerReadyUI];
    } else {
        [self showKeyInputUI];
    }
}

- (void)showServerReadyUI {
    // Remove any old views
    [[self.view subviews] makeObjectsPerformSelector:@selector(removeFromSuperview)];
    
    UILabel *status = [[UILabel alloc] init];
    status.text = @"✓ API Key loaded\nServer running — use your computer to connect!";
    status.numberOfLines = 0;
    status.textAlignment = NSTextAlignmentCenter;
    status.font = [UIFont preferredFontForTextStyle:UIFontTextStyleTitle2];
    [self.view addSubview:status];
    
    // Simple constraints (using Masonry for brevity — or use anchors)
    [status mas_makeConstraints:^(MASConstraintMaker *make) {
        make.center.equalTo(self.view);
        make.left.right.greaterThanOrEqualTo(self.view).offset(20);
    }];
    
    // Optional: Add "Change API Key" button
    UIButton *changeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [changeButton setTitle:@"Change API Key" forState:UIControlStateNormal];
    [changeButton addTarget:self action:@selector(resetAndShowInput) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:changeButton];
    
    [changeButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.centerX.equalTo(self.view);
        make.top.equalTo(status.mas_bottom).offset(40);
    }];
}

- (void)showKeyInputUI {
    [[self.view subviews] makeObjectsPerformSelector:@selector(removeFromSuperview)];
    
    UILabel *title = [[UILabel alloc] init];
    title.text = @"Grok Student Setup";
    title.font = [UIFont preferredFontForTextStyle:UIFontTextStyleTitle1];
    title.textAlignment = NSTextAlignmentCenter;
    [self.view addSubview:title];
    
    UILabel *label = [[UILabel alloc] init];
    label.text = @"Enter your free API key (Gemini or Groq recommended):";
    label.numberOfLines = 0;
    label.textAlignment = NSTextAlignmentCenter;
    [self.view addSubview:label];
    
    self.apiKeyField = [[UITextField alloc] init];
    self.apiKeyField.borderStyle = UITextBorderStyleRoundedRect;
    self.apiKeyField.placeholder = @"Paste your API key here";
    self.apiKeyField.secureTextEntry = YES;
    self.apiKeyField.font = [UIFont systemFontOfSize:16];
    [self.view addSubview:self.apiKeyField];
    
    self.saveButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [self.saveButton setTitle:@"Save Key & Start Server" forState:UIControlStateNormal];
    self.saveButton.titleLabel.font = [UIFont boldSystemFontOfSize:18];
    [self.saveButton addTarget:self action:@selector(saveKey) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:self.saveButton];
    
    // Layout (example with manual constraints)
    [title mas_makeConstraints:^(MASConstraintMaker *make) {
        make.top.equalTo(self.view.safeAreaLayoutGuide).offset(60);
        make.left.right.equalTo(self.view).inset(20);
    }];
    
    [label mas_makeConstraints:^(MASConstraintMaker *make) {
        make.top.equalTo(title.mas_bottom).offset(40);
        make.left.right.equalTo(self.view).inset(40);
    }];
    
    [self.apiKeyField mas_makeConstraints:^(MASConstraintMaker *make) {
        make.top.equalTo(label.mas_bottom).offset(20);
        make.left.right.equalTo(self.view).inset(40);
        make.height.equalTo(@50);
    }];
    
    [self.saveButton mas_makeConstraints:^(MASConstraintMaker *make) {
        make.top.equalTo(self.apiKeyField.mas_bottom).offset(30);
        make.centerX.equalTo(self.view);
        make.width.equalTo(@250);
        make.height.equalTo(@60);
    }];
}

- (void)saveKey {
    NSString *key = self.apiKeyField.text;
    key = [key stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    
    if (key.length == 0) {
        [self showAlert:@"Error" message:@"Please enter a valid API key."];
        return;
    }
    
    if ([KeychainHelper saveAPIKey:key]) {
        // Start the server now!
        self.grokServer = [[GrokServer alloc] init];
        BOOL started = [self.grokServer startServer];
        
        if (started) {
            [self showServerReadyUI];
        } else {
            [self showAlert:@"Server Error" message:@"Failed to start server. Check console logs."];
        }
    } else {
        [self showAlert:@"Save Failed" message:@"Could not save key to Keychain."];
    }
}

- (void)resetAndShowInput {
    [KeychainHelper deleteAPIKey];
    [self.grokServer stopServer];
    self.grokServer = nil;
    [self showKeyInputUI];
}

- (void)showAlert:(NSString *)title message:(NSString *)message {
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:title
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
    [self presentViewController:alert animated:YES completion:nil];
}

@end
