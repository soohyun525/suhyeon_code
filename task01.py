from selenium import webdriver

driver_path = '../resources/chromedriver'  # driver path
url = 'https://play.google.com/store/apps/top/category/GAME'

browser = webdriver.Chrome(executable_path=driver_path)  # Chrome driver
browser.get(url)

browser.quit()


